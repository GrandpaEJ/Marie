import { countTokens, countMessagesTokens } from '../llm/tokenizer.js';

/**
 * Budget allocation ratios for context tiers.
 * Identity is fixed, the rest are proportional.
 */
const BUDGET_RATIOS = {
  identity: 0.15,  // Persona + bot self-knowledge
  facts: 0.10,     // User facts
  ltm: 0.20,       // Long-term memory summaries
  stm: 0.55        // Short-term memory (recent messages)
};

/**
 * Assembles the final message array for the LLM call,
 * packing context optimally within the token budget.
 * 
 * @param {Object} params
 * @param {string} params.persona - System prompt / persona text
 * @param {string|null} params.factsBlock - Formatted user facts
 * @param {string|null} params.userName - User's display name
 * @param {Array} params.summaries - LTM summary objects [{summary: "..."}]
 * @param {Array} params.stmMessages - Recent messages [{role, content}]
 * @param {string} params.currentMessage - The new user message
 * @param {number} params.maxTokens - Total context budget (default 8192)
 * @returns {Array} Messages array ready for LLM
 */
export function assembleContext({
  persona,
  factsBlock,
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

  // ── 1. Identity Layer (System Prompt) ──────────────────────────────────
  let systemContent = persona || 'You are Marie, a helpful AI assistant.';
  
  // Add user awareness
  if (userName) {
    systemContent += `\n\nYou are currently talking to ${userName}.`;
  }

  // Trim if over identity budget (unlikely but safe)
  if (countTokens(systemContent) > budget.identity) {
    // Truncate persona to fit
    const words = systemContent.split(' ');
    while (countTokens(words.join(' ')) > budget.identity && words.length > 10) {
      words.pop();
    }
    systemContent = words.join(' ') + '...';
  }

  messages.push({ role: 'system', content: systemContent });

  // ── 2. Facts Layer ─────────────────────────────────────────────────────
  if (factsBlock) {
    const factsContent = `[Memory — What you know about this user]\n${factsBlock}`;
    if (countTokens(factsContent) <= budget.facts) {
      messages.push({ role: 'system', content: factsContent });
    } else {
      // Trim facts to fit budget
      const lines = factsBlock.split('\n');
      let trimmed = '';
      for (const line of lines) {
        const candidate = trimmed + line + '\n';
        if (countTokens(`[Memory — What you know about this user]\n${candidate}`) > budget.facts) break;
        trimmed = candidate;
      }
      if (trimmed) {
        messages.push({ role: 'system', content: `[Memory — What you know about this user]\n${trimmed.trim()}` });
      }
    }
  }

  // ── 3. LTM Layer (Summaries) ───────────────────────────────────────────
  if (summaries && summaries.length > 0) {
    const summaryTexts = summaries.map(s => s.summary);
    let ltmContent = `[Memory — Previous conversation context]\n${summaryTexts.join('\n---\n')}`;

    if (countTokens(ltmContent) > budget.ltm) {
      // Keep only the most recent summaries that fit
      const kept = [];
      for (let i = summaryTexts.length - 1; i >= 0; i--) {
        const candidate = [...kept, summaryTexts[i]].reverse();
        const content = `[Memory — Previous conversation context]\n${candidate.join('\n---\n')}`;
        if (countTokens(content) > budget.ltm) break;
        kept.unshift(summaryTexts[i]);
      }
      if (kept.length > 0) {
        ltmContent = `[Memory — Previous conversation context]\n${kept.join('\n---\n')}`;
      } else {
        ltmContent = null;
      }
    }

    if (ltmContent) {
      messages.push({ role: 'system', content: ltmContent });
    }
  }

  // ── 4. STM Layer (Recent Messages) ─────────────────────────────────────
  // Reserve space for the current message
  const currentMsgTokens = countTokens(currentMessage) + 4; // +4 overhead
  const stmBudget = budget.stm - currentMsgTokens;

  // Add STM messages from most recent, working backwards
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

  // Add current user message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}
