import { MemoryManager } from '../memory/memory-manager.js';

let memoryManager = null;

function getMemoryManager(config) {
  if (!memoryManager) {
    memoryManager = new MemoryManager(config);
  }
  return memoryManager;
}

export default {
  name: 'chat',
  description: 'Main RP chat handler',
  minRole: 'user',
  handler: async (ctx) => {
    const { api, event, llm, config, user } = ctx;
    const { threadID, senderID, body, messageID } = event;

    // Get sender name from user store or event
    const senderName = user?.name || event.senderName || null;

    // 1. Show typing indicator
    await api.sendTypingIndicator(true, threadID);

    try {
      // 2. Build context using MemoryManager
      const mm = getMemoryManager(config);
      const { messages, model } = mm.buildContext(threadID, senderID, senderName, body);

      console.log(`[Chat] Calling LLM with ${messages.length} messages (model: ${model})...`);

      // 3. Call LLM
      const response = await llm.chat(messages, {
        model: model,
        temperature: config.llm.temperature
      });

      console.log(`[Chat] LLM responded with ${response.content.length} chars.`);

      // 4. Post-response: store messages, extract facts, maybe summarize
      await mm.afterResponse(threadID, senderID, body, response, llm);

      // 5. Send response
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
      await api.sendTypingIndicator(false, threadID);
    }
  }
};
