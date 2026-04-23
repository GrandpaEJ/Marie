import { countMessagesTokens } from './tokenizer.js';

/**
 * Manages the conversation context window.
 * Trims old messages if they exceed the token budget.
 */
export class ContextManager {
  constructor(maxTokens = 8192, summaryThreshold = 0.7) {
    this.maxTokens = maxTokens;
    this.threshold = Math.floor(maxTokens * summaryThreshold);
  }

  /**
   * Trims message history to fit within the budget.
   * Always keeps the system prompt and the last N messages.
   * @param {Array} history 
   * @param {Object} systemPrompt {role: 'system', content: '...'}
   * @returns {Array}
   */
  trimHistory(history, systemPrompt) {
    let context = [systemPrompt, ...history];
    let totalTokens = countMessagesTokens(context);

    if (totalTokens <= this.maxTokens) {
      return history;
    }

    console.log(`Context overflow: ${totalTokens}/${this.maxTokens}. Trimming...`);

    // Remove from the beginning of history (after system prompt)
    const newHistory = [...history];
    while (newHistory.length > 1 && totalTokens > this.maxTokens) {
      newHistory.shift();
      totalTokens = countMessagesTokens([systemPrompt, ...newHistory]);
    }

    return newHistory;
  }

  /**
   * Future: Implement summarization of old history.
   * For now, just rolling window.
   */
  async summarize(history, llm) {
    // Placeholder for summarization logic
    return history;
  }
}
