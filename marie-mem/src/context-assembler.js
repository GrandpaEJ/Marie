import { countTokens } from '@marie/brain';

/**
 * Budget allocation ratios for context tiers.
 * Can be overridden via config.json: config.memory.budgetRatios
 */
const DEFAULT_BUDGET_RATIOS = {
  identity: 0.15,
  facts: 0.10,
  ltm: 0.20,
  stm: 0.55
};

/**
 * Assembles the final message array for the LLM call.
 */
export function assembleContext({
  persona,
  facts,
  userName,
  summaries,
  stmMessages,
  currentMessage,
  maxTokens = 8192,
  config = {}, // Pass config to allow ratio overrides
  sessionContext = null
}) {
  const ratios = config.memory?.budgetRatios || DEFAULT_BUDGET_RATIOS;
  
  const budget = {
    identity: Math.floor(maxTokens * ratios.identity),
    facts: Math.floor(maxTokens * ratios.facts),
    ltm: Math.floor(maxTokens * ratios.ltm),
    stm: Math.floor(maxTokens * ratios.stm)
  };

  const messages = [];

  // ── 1. Identity & System Layer ──────────────────────────────────────────
  let systemContent = '';
  
  if (config.useMasterPrompt) {
    // If master prompt is enabled, we'll use the passed systemContent or build it
    systemContent = persona; 
  } else {
    // Legacy / Basic mode
    systemContent = persona || 'You are Marie, a helpful AI assistant.';
    if (userName) systemContent += `\n\nYou are currently talking to ${userName}.`;
    
    const now = new Date();
    const dhakaTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit', minute: '2-digit', weekday: 'long', month: 'short', day: 'numeric'
    }).format(now);
    
    systemContent += `\n\n[CONTEXT] Current Local Time (Asia/Dhaka): ${dhakaTime}`;
    systemContent += `\n\n[CRITICAL] Use tool calling if available. Fallback: START your message with {"name": "tool", "arguments": {}}`;
  }

  if (sessionContext) {
    systemContent += `\n\n[SESSION]\n${sessionContext}`;
  }

  messages.push({ role: 'system', content: systemContent });

  // ── 2. Facts Layer (Pre-filtered by FTS5) ──────────────────────────────
  // Separate Core Identity from Topic-relevant facts
  const coreCategories = ['name', 'age', 'identity', 'gender'];
  const coreFacts = facts.filter(f => coreCategories.includes(f.category));
  const otherFacts = facts.filter(f => !coreCategories.includes(f.category));

  const recentText = (stmMessages.slice(-3).map(m => m.content).join(' ') + ' ' + currentMessage).toLowerCase();
  
  let factsContent = '';

  // 2a. Core Identity (Budget-exempt up to 200 tokens)
  if (coreFacts.length > 0) {
    factsContent += '[User Identity]\n' + coreFacts.map(f => `${f.fact_key}: ${f.fact_value}`).join(', ') + '\n';
  }

  // 2b. Preferences & Topics (Budgeted)
  if (otherFacts.length > 0) {
    const grouped = {};
    for (const f of otherFacts) {
      const isRelevantToTopic = recentText.includes(f.fact_key.toLowerCase()) || recentText.includes(f.fact_value.toString().toLowerCase());
      if (!grouped[f.category]) grouped[f.category] = [];
      if (isRelevantToTopic) {
        grouped[f.category].unshift(`${f.fact_key}: ${f.fact_value} [Relevant]`);
      } else {
        grouped[f.category].push(`${f.fact_key}: ${f.fact_value}`);
      }
    }

    factsContent += '\n[Contextual Preferences]\n';
    for (const [cat, items] of Object.entries(grouped)) {
      factsContent += `[${cat}] ${items.join(', ')}\n`;
    }
  }

  if (countTokens(factsContent) > budget.facts + 200) {
    // Basic trimming if somehow massive
    factsContent = factsContent.slice(0, 2000) + '...';
  }
  
  if (factsContent) messages.push({ role: 'system', content: factsContent.trim() });

  // ── 3. LTM Layer (Pre-filtered by FTS5) ────────────────────────────────
  if (summaries && summaries.length > 0) {
    const summaryTexts = summaries.map(s => s.summary);
    let ltmContent = `[Memory — Relevant previous context]\n${summaryTexts.join('\n---\n')}`;

    if (countTokens(ltmContent) > budget.ltm) {
      const kept = [];
      for (let i = summaryTexts.length - 1; i >= 0; i--) {
        if (countTokens(`[Memory — Relevant previous context]\n${[...kept, summaryTexts[i]].join('\n---\n')}`) > budget.ltm) break;
        kept.unshift(summaryTexts[i]);
      }
      ltmContent = kept.length > 0 ? `[Memory — Relevant previous context]\n${kept.join('\n---\n')}` : null;
    }

    if (ltmContent) messages.push({ role: 'system', content: ltmContent });
  }

  // ── 4. STM Layer (with ANCHORING) ──────────────────────────────────────
  const currentMsgTokens = countTokens(currentMessage) + 4;
  let remainingStmBudget = budget.stm - currentMsgTokens;

  // ANCHOR: Last 3 user messages ALWAYS included
  const anchors = [];
  let anchorTokens = 0;
  const userMsgs = stmMessages.filter(m => m.role === 'user').slice(-3);
  
  for (const m of userMsgs) {
    const tokens = countTokens(m.content) + 4;
    anchors.push(m);
    anchorTokens += tokens;
  }
  
  remainingStmBudget -= anchorTokens;

  const stmToAdd = [];
  let stmUsed = 0;
  
  // Fill remaining budget from middle messages, excluding anchors
  const nonAnchors = stmMessages.filter(m => !anchors.includes(m));
  
  for (let i = nonAnchors.length - 1; i >= 0; i--) {
    const msg = nonAnchors[i];
    const msgTokens = countTokens(msg.content) + 4;
    if (stmUsed + msgTokens > remainingStmBudget) break;
    stmToAdd.unshift(msg);
    stmUsed += msgTokens;
  }

  // Merge anchors back in correct chronological position
  const finalStm = [...stmMessages].filter(m => stmToAdd.includes(m) || anchors.includes(m));

  messages.push(...finalStm.map(m => ({ role: m.role, content: m.content })));
  messages.push({ role: 'user', content: currentMessage });

  // ── 5. OVERFLOW WARNING ───────────────────────────────────────────────
  const finalTotalTokens = messages.reduce((sum, m) => sum + countTokens(m.content) + 4, 0);
  if (finalTotalTokens > maxTokens * 0.9) {
    console.warn(`[ContextAssembler] High token usage: ${finalTotalTokens}/${maxTokens} (${Math.round(finalTotalTokens/maxTokens*100)}%)`);
  }

  return messages;
}
