import { getActiveMessages, getSummaries, buildFactsBlock } from '../storage/memory-store.js';
import { getThread, addMessage, logUsage } from '../storage/thread-store.js';
import { getUser, createUser } from '../storage/user-store.js';
import { assembleContext } from './context-assembler.js';
import { extractFacts } from './fact-extractor.js';
import { maybeSummarize } from './summarizer.js';

/**
 * Central orchestrator for Marie's multi-tier memory system.
 * Coordinates STM, LTM, Facts, and Identity layers.
 */
export class MemoryManager {
  constructor(config) {
    this.config = config;
    this.maxTokens = config.llm?.maxContextTokens || 8192;
  }

  /**
   * Build the full context for an LLM call.
   * Loads all memory tiers and assembles them within the token budget.
   * 
   * @param {string} threadId
   * @param {string} senderUid
   * @param {string} senderName
   * @param {string} currentMessage
   * @returns {Object} { messages, persona, model }
   */
  buildContext(threadId, senderUid, senderName, currentMessage) {
    // 1. Ensure user exists in DB
    let user = getUser(senderUid);
    if (!user) {
      user = createUser(senderUid, senderName || `User_${senderUid.slice(-4)}`);
    } else if (senderName && user.name !== senderName) {
      // Update name if changed
      createUser(senderUid, senderName, user.role);
    }

    // 2. Get thread config
    const thread = getThread(threadId);
    const persona = thread.persona || this.config.rp?.defaultPersona;
    const model = thread.model || this.config.llm?.defaultModel;

    // 3. Load memory tiers
    const factsBlock = buildFactsBlock(senderUid);
    const summaries = getSummaries(threadId, 5);
    const stmMessages = getActiveMessages(threadId, 20);

    // 4. Assemble context
    const messages = assembleContext({
      persona,
      factsBlock,
      userName: senderName || user.name,
      summaries,
      stmMessages,
      currentMessage,
      maxTokens: this.maxTokens
    });

    return { messages, persona, model, user };
  }

  /**
   * Post-response processing: store messages, extract facts, trigger summarization.
   * 
   * @param {string} threadId
   * @param {string} senderUid
   * @param {string} userMessage
   * @param {Object} response - LLM response { content, usage, model }
   * @param {Object} llm - LLM provider instance
   */
  async afterResponse(threadId, senderUid, userMessage, response, llm) {
    // 1. Store messages in DB with UID for user messages
    addMessage(threadId, 'user', userMessage, 0, senderUid);
    addMessage(threadId, 'assistant', response.content, response.usage?.completion_tokens);

    // 2. Log token usage
    logUsage(
      threadId,
      senderUid,
      response.model,
      response.usage?.prompt_tokens,
      response.usage?.completion_tokens,
      0
    );

    // 3. Extract facts (async, non-blocking — fire and forget)
    const factsBlock = buildFactsBlock(senderUid);
    extractFacts(llm, userMessage, response.content, factsBlock, {
      uid: senderUid,
      threadId,
      model: response.model
    }).catch(e => console.warn('[MemoryManager] Fact extraction background error:', e.message));

    // 4. Maybe trigger summarization (async, non-blocking)
    maybeSummarize(threadId, llm, {
      model: response.model
    }).catch(e => console.warn('[MemoryManager] Summarization background error:', e.message));
  }
}
