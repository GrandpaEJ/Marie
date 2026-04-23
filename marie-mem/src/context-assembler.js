import { countTokens } from '@marie/llm';

/**
 * Budget allocation ratios for context tiers.
 */
const BUDGET_RATIOS = {
  identity: 0.15,
  facts: 0.10,
  ltm: 0.20,
  stm: 0.55
};

/**
 * Assembles the final message array for the LLM call.
 * 
 * @param {Object} params
 * @param {string} params.persona
 * @param {Array|null} params.facts - Filtered fact objects
 * @param {string|null} params.userName
 * @param {Array} params.summaries - Filtered summary objects
 * @param {Array} params.stmMessages
 * @param {string} params.currentMessage
 * @param {number} params.maxTokens
 * @returns {Array}
 */
export function assembleContext({
  persona,
  facts,
  userName,
  summaries,
  stmMessages,
  currentMessage,
  maxTokens = 8192
}) {
  const budget = {
    identity: Math.floor(maxTokens * BUDGET_RATIOS.identity),
    facts: Math.floor(maxTokens * BUDGET_RATIOS.facts),
    ltm: Math.floor(maxTokens * BUDGET_RATIOS.ltm),
    stm: Math.floor(maxTokens * BUDGET_RATIOS.stm)
  };

  const messages = [];

  // ── 1. Identity Layer ──────────────────────────────────────────────────
  let systemContent = persona || 'You are Marie, a helpful AI assistant.';
  if (userName) systemContent += `\n\nYou are currently talking to ${userName}.`;

  if (countTokens(systemContent) > budget.identity) {
    const words = systemContent.split(' ');
    while (countTokens(words.join(' ')) > budget.identity && words.length > 10) words.pop();
    systemContent = words.join(' ') + '...';
  }
  messages.push({ role: 'system', content: systemContent });

  // ── 2. Facts Layer (Pre-filtered by FTS5) ──────────────────────────────
  if (facts && facts.length > 0) {
    const grouped = {};
    for (const f of facts) {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(`${f.fact_key}: ${f.fact_value}`);
    }

    let factsContent = '[Memory — Relevant facts about this user]\n';
    for (const [cat, items] of Object.entries(grouped)) {
      factsContent += `[${cat}] ${items.join(', ')}\n`;
    }

    if (countTokens(factsContent) > budget.facts) {
      const lines = factsContent.split('\n');
      let trimmed = '';
      for (const line of lines) {
        if (countTokens(trimmed + line + '\n') > budget.facts) break;
        trimmed += line + '\n';
      }
      factsContent = trimmed.trim();
    }
    
    if (factsContent) messages.push({ role: 'system', content: factsContent.trim() });
  }

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

  // ── 4. STM Layer ───────────────────────────────────────────────────────
  const currentMsgTokens = countTokens(currentMessage) + 4;
  const stmBudget = budget.stm - currentMsgTokens;

  const stmToAdd = [];
  let stmUsed = 0;
  for (let i = stmMessages.length - 1; i >= 0; i--) {
    const msg = stmMessages[i];
    const msgTokens = countTokens(msg.content) + 4;
    if (stmUsed + msgTokens > stmBudget) break;
    stmToAdd.unshift(msg);
    stmUsed += msgTokens;
  }

  messages.push(...stmToAdd.map(m => ({ role: m.role, content: m.content })));
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}
