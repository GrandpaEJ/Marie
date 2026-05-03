import { addSummary, archiveMessages, getMessagesForSummarization, countActiveMessages, getSummariesForConsolidation, archiveSummaries } from './storage.js';
import { activeBuffer } from './active-buffer.js';

const SUMMARIZE_PROMPT = `Summarize the following conversation segment in 2-3 concise sentences.
Include: key user decisions, emotional tone, specific preferences shared, and important context.
Focus on: "What would I need to know to continue this talk tomorrow?"
Do NOT include greetings or filler. Write in third person.
Maximum 3 sentences.`;

const CONSOLIDATE_PROMPT = `The following are multiple short summaries of a conversation. 
Merge them into a single, cohesive high-level summary.
Maintain: Core user identity, recurring topics, and major milestones.
Maximum 5 sentences.`;

const SUMMARIZE_THRESHOLD = 15;
const BATCH_SIZE = 10;

/**
 * Check if summarization is needed and perform it.
 */
export async function maybeSummarize(threadId, llm, options = {}) {
  const activeCount = countActiveMessages(threadId);
  const maxTokens = options.maxTokens || 8192;
  const currentTokens = activeBuffer.getTokenCount(threadId);

  // Trigger: Message count threshold OR Token usage > 80% (Emergency Summarize)
  if (activeCount >= SUMMARIZE_THRESHOLD || currentTokens > maxTokens * 0.8) {
    if (currentTokens > maxTokens * 0.8) {
      console.log(`[Summarizer] Emergency trigger: ${currentTokens}/${maxTokens} tokens used in ${threadId}`);
    }
    await performSummarization(threadId, llm, options);
  }

  // Trigger consolidation checks
  if (activeCount % 50 === 0) { // check for daily consolidation every 50 msgs
    await consolidateSummaries(threadId, 'conversation', 'daily', 24, llm, options);
  }
  if (activeCount % 200 === 0) { // check for weekly consolidation
    await consolidateSummaries(threadId, 'daily', 'weekly', 24 * 7, llm, options);
  }

  return true;
}

async function performSummarization(threadId, llm, options) {
  let retries = 1;
  while (retries >= 0) {
    try {
      const batch = getMessagesForSummarization(threadId, BATCH_SIZE);
      if (batch.length < 3) return;

      const conversationText = batch.map(m => {
        const speaker = m.role === 'user' ? 'User' : 'Marie';
        return `${speaker}: ${m.content}`;
      }).join('\n');

      const response = await llm.chat([
        { role: 'system', content: SUMMARIZE_PROMPT },
        { role: 'user', content: conversationText }
      ], {
        model: options.model,
        temperature: 0.3,
        max_tokens: 250
      });

      let summary = response.content.trim();
      
      // Validation: Discard if too short
      if (summary.length < 10) {
        console.warn(`[Summarizer] Summary too short (${summary.length} chars), retrying...`);
        retries--;
        continue;
      }

      const fromTs = batch[0].timestamp;
      const toTs = batch[batch.length - 1].timestamp;

      addSummary(threadId, summary, fromTs, toTs, batch.length, 'conversation');
      archiveMessages(threadId, toTs);

      console.log(`[Summarizer] Compressed ${batch.length} messages → conversation summary`);
      return; // Success
    } catch (error) {
      console.warn('[Summarizer] performSummarization error:', error.message);
      retries--;
    }
  }
}

/**
 * Consolidates lower-level summaries into higher-level ones (e.g., conversation -> daily).
 */
async function consolidateSummaries(threadId, fromLevel, toLevel, hours, llm, options) {
  try {
    const batch = getSummariesForConsolidation(threadId, fromLevel, hours);
    if (batch.length < 5) return; // Only consolidate if there's enough substance

    console.log(`[Summarizer] Consolidating ${batch.length} ${fromLevel} summaries into ${toLevel}...`);

    const combinedText = batch.map(s => s.summary).join('\n---\n');

    const response = await llm.chat([
      { role: 'system', content: CONSOLIDATE_PROMPT },
      { role: 'user', content: combinedText }
    ], {
      model: options.model,
      temperature: 0.3,
      max_tokens: 400
    });

    const consolidated = response.content.trim();
    if (consolidated.length < 20) return;

    const fromTs = batch[0].from_timestamp;
    const toTs = batch[batch.length - 1].to_timestamp;
    const totalMsgs = batch.reduce((sum, s) => sum + s.msg_count, 0);

    addSummary(threadId, consolidated, fromTs, toTs, totalMsgs, toLevel);
    archiveSummaries(batch.map(s => s.id));

    console.log(`[Summarizer] Success: Created ${toLevel} summary for ${threadId}`);
  } catch (error) {
    console.warn(`[Summarizer] Consolidation (${fromLevel}->${toLevel}) failed:`, error.message);
  }
}
