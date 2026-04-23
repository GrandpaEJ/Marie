import { addSummary, archiveMessages, getMessagesForSummarization, countActiveMessages } from '../storage/memory-store.js';

const SUMMARIZE_PROMPT = `Summarize the following conversation segment in 2-3 concise sentences.
Preserve: key events, emotional tone, decisions made, and any important context.
Do NOT include greetings or filler. Focus on what matters for continuity.
Write in third person (e.g., "The user discussed..." / "They agreed to...").`;

const SUMMARIZE_THRESHOLD = 15; // Trigger when this many active messages exist
const BATCH_SIZE = 10;          // Summarize this many oldest messages at a time

/**
 * Check if summarization is needed and perform it.
 * @param {string} threadId
 * @param {Object} llm - LLM provider instance
 * @param {Object} options - { model }
 * @returns {boolean} Whether summarization was triggered
 */
export async function maybeSummarize(threadId, llm, options = {}) {
  const activeCount = countActiveMessages(threadId);

  if (activeCount < SUMMARIZE_THRESHOLD) {
    return false;
  }

  console.log(`[Summarizer] ${activeCount} active messages in ${threadId}, triggering summarization...`);

  try {
    // Get oldest batch of active messages
    const batch = getMessagesForSummarization(threadId, BATCH_SIZE);
    if (batch.length < 3) return false; // Not enough to summarize

    // Build conversation text for summarization
    const conversationText = batch.map(m => {
      const speaker = m.role === 'user' ? 'User' : 'Marie';
      return `${speaker}: ${m.content}`;
    }).join('\n');

    const messages = [
      { role: 'system', content: SUMMARIZE_PROMPT },
      { role: 'user', content: conversationText }
    ];

    const response = await llm.chat(messages, {
      model: options.model || 'google/gemma-3-8b-it:free',
      temperature: 0.3,
      max_tokens: 200
    });

    const summary = response.content.trim();
    const fromTs = batch[0].timestamp;
    const toTs = batch[batch.length - 1].timestamp;

    // Store summary in LTM
    addSummary(threadId, summary, fromTs, toTs, batch.length);

    // Archive the summarized messages
    archiveMessages(threadId, toTs);

    console.log(`[Summarizer] Compressed ${batch.length} messages → LTM summary (${summary.length} chars)`);
    return true;
  } catch (error) {
    console.warn('[Summarizer] Summarization failed:', error.message);
    return false;
  }
}
