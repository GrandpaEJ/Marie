import { assembleContext } from './context-assembler.js';
import { extractFacts } from './fact-extractor.js';
import { maybeSummarize } from './summarizer.js';
import * as storage from './storage.js';
import { activeBuffer } from './active-buffer.js';
import { sessionManager } from './session-manager.js';
import { buildMasterPrompt } from './prompts/master.js';

/**
 * Central orchestrator for Marie's multi-tier memory system.
 */
export class MemoryManager {
  constructor(config, dependencies) {
    this.config = config;
    this.db = dependencies.db;
    this.userStore = dependencies.userStore;
    this.threadStore = dependencies.threadStore;
    this.maxTokens = config.llm?.maxContextTokens || 8192;

    storage.initStorage(this.db);
    sessionManager.init(this.db);
  }

  /**
   * Build the full context for an LLM call.
   */
  buildContext(threadId, senderUid, senderName, currentMessage, tools = [], providerName = 'openai') {
    // 0. Clean expired facts
    storage.cleanExpiredFacts();

    // 0.5 Handle Session
    const { session, isNew } = sessionManager.getOrCreateSession(threadId);
    let sessionContext = null;
    if (isNew) {
      const lastSummary = sessionManager.getLastSessionSummary(threadId);
      if (lastSummary) {
        sessionContext = `[Welcome Back] Last time you talked, the session ended with this summary: ${lastSummary}`;
      }
    }

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

    // 4. Build Master Prompt
    const masterPrompt = buildMasterPrompt({
      persona,
      userName: senderName || user.name,
      tools,
      providerUsed: providerName,
      userFacts: facts.map(f => `${f.fact_key}: ${f.fact_value}`).join('\n'),
      sessionContext,
      platform: this.config.platform || 'telegram'
    });

    // 5. Assemble context
    const messages = assembleContext({
      persona: masterPrompt,
      facts: [], // Already included in master prompt
      userName: senderName || user.name,
      summaries,
      stmMessages,
      currentMessage,
      maxTokens: this.maxTokens,
      config: { ...this.config, useMasterPrompt: true },
      sessionContext: null // Already included in master prompt
    });

    return { messages, persona, model, user };
  }

  /**
   * Post-response processing.
   */
  async afterResponse(threadId, senderUid, userMessage, response, llm) {
    // Update session activity
    sessionManager.touch(threadId);

    // 1. Store messages
    this.threadStore.addMessage(threadId, 'user', userMessage, 0, senderUid);
    this.threadStore.addMessage(threadId, 'assistant', response.content, response.usage?.completion_tokens);

    // 1.5 Push to ActiveBuffer for instant access
    activeBuffer.push(threadId, { role: 'user', content: userMessage, timestamp: Date.now(), uid: senderUid });
    activeBuffer.push(threadId, { role: 'assistant', content: response.content, timestamp: Date.now(), tokens: response.usage?.completion_tokens });

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
