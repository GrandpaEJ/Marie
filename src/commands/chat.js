import { getThread, addMessage, getHistory, logUsage } from '../storage/thread-store.js';
import { ContextManager } from '../llm/context-manager.js';
import { buildSystemPrompt } from '../llm/prompt-builder.js';

const contextManager = new ContextManager();

export default {
  name: 'chat',
  description: 'Main RP chat handler',
  minRole: 'user',
  handler: async (ctx) => {
    const { api, event, llm, config, user } = ctx;
    const { threadID, body, messageID } = event;

    // 1. Get thread config
    const thread = getThread(threadID);
    const persona = thread.persona || config.rp.defaultPersona;
    const model = thread.model || config.llm.defaultModel;

    // 2. Show typing indicator
    const stopTyping = api.sendTypingIndicator(threadID);

    try {
      // 3. Prepare context
      const systemPrompt = buildSystemPrompt(persona);
      const rawHistory = getHistory(threadID, 20);
      
      const history = rawHistory.map(m => ({
        role: m.role,
        content: m.content
      }));

      const messages = contextManager.trimHistory(
        [...history, { role: 'user', content: body }],
        systemPrompt
      );

      // 4. Call LLM
      const response = await llm.chat(messages, {
        model: model,
        temperature: config.llm.temperature
      });

      // 5. Store in DB
      addMessage(threadID, 'user', body);
      addMessage(threadID, 'assistant', response.content, response.usage?.completion_tokens);
      
      // Log usage for analytics
      logUsage(
        threadID, 
        user.uid, 
        response.model, 
        response.usage?.prompt_tokens, 
        response.usage?.completion_tokens,
        0 // Future: calculate actual cost
      );

      // 6. Send response
      // Split long messages if necessary (FB limit ~20k, but let's be safe at 2k)
      if (response.content.length > 2000) {
        const chunks = response.content.match(/[\s\S]{1,2000}/g) || [];
        for (const chunk of chunks) {
          await api.sendMessage(chunk, threadID, messageID);
        }
      } else {
        await api.sendMessage(response.content, threadID, messageID);
      }

    } catch (error) {
      console.error("Chat handler error:", error);
      api.sendMessage(`[Marie] Chat error: ${error.message}`, threadID);
    } finally {
      if (typeof stopTyping === 'function') stopTyping();
    }
  }
};
