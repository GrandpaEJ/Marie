import { assembleContext } from './context-assembler.js';
import { extractFacts } from './fact-extractor.js';
import { maybeSummarize } from './summarizer.js';
import * as storage from './storage.js';

/**
 * Central orchestrator for Marie's multi-tier memory system.
 * Coordinates STM, LTM, Facts, and Identity layers.
 */
export class MemoryManager {
  /**
   * @param {Object} config - Project configuration
   * @param {Object} dependencies - { db, userStore, threadStore }
   */
  constructor(config, dependencies) {
    this.config = config;
    this.db = dependencies.db;
    this.userStore = dependencies.userStore;
    this.threadStore = dependencies.threadStore;
    this.maxTokens = config.llm?.maxContextTokens || 8192;

    // Initialize storage with db
    storage.initStorage(this.db);
  }

  /**
   * Build the full context for an LLM call.
   */
  buildContext(threadId, senderUid, senderName, currentMessage) {
    // 1. Ensure user exists
    let user = this.userStore.getUser(senderUid);
    if (!user) {
      user = this.userStore.createUser(senderUid, senderName || `User_${senderUid.slice(-4)}`);
    } else if (senderName && user.name !== senderName) {
      this.userStore.createUser(senderUid, senderName, user.role);
    }

    // 2. Get thread config
    const thread = this.threadStore.getThread(threadId);
    const persona = thread.persona || this.config.rp?.defaultPersona;
    const model = thread.model || this.config.llm?.defaultModel;

    // 3. Load memory tiers
    const coreFacts = [
      ...storage.getFactsByCategory(senderUid, 'name'),
      ...storage.getFactsByCategory(senderUid, 'age'),
      ...storage.getFactsByCategory(senderUid, 'identity')
    ];
    
    const relevantFacts = storage.searchFacts(senderUid, currentMessage, 10);
    
    const factsMap = new Map();
    [...coreFacts, ...relevantFacts].forEach(f => factsMap.set(f.id, f));
    const facts = Array.from(factsMap.values());

    const summaries = storage.searchSummaries(threadId, currentMessage, 5);
    const stmMessages = storage.getActiveMessages(threadId, 20);

    // 4. Assemble context
    const messages = assembleContext({
      persona,
      facts,
      userName: senderName || user.name,
      summaries,
      stmMessages,
      currentMessage,
      maxTokens: this.maxTokens
    });

    return { messages, persona, model, user };
  }

  /**
   * Post-response processing.
   */
  async afterResponse(threadId, senderUid, userMessage, response, llm) {
    // 1. Store messages
    this.threadStore.addMessage(threadId, 'user', userMessage, 0, senderUid);
    this.threadStore.addMessage(threadId, 'assistant', response.content, response.usage?.completion_tokens);

    // 2. Log token usage
    this.threadStore.logUsage(
      threadId,
      senderUid,
      response.model,
      response.usage?.prompt_tokens,
      response.usage?.completion_tokens,
      0
    );

    // 3. Extract facts
    const factsBlock = storage.buildFactsBlock(senderUid);
    extractFacts(llm, userMessage, response.content, factsBlock, {
      uid: senderUid,
      threadId,
      model: response.model
    }).catch(e => console.warn('[MemoryManager] Fact extraction background error:', e.message));

    // 4. Maybe trigger summarization
    maybeSummarize(threadId, llm, {
      model: response.model
    }).catch(e => console.warn('[MemoryManager] Summarization background error:', e.message));
  }
}
