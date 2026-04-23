import { getEncoding } from 'js-tiktoken';

// Use cl100k_base as a general estimate for most modern models
const encoding = getEncoding('cl100k_base');

export function countTokens(text) {
  if (!text) return 0;
  return encoding.encode(text).length;
}

export function countMessagesTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    // Basic estimate: content + role + overhead
    total += countTokens(msg.content);
    total += 4; // Overhead per message
  }
  total += 3; // Final assistant prompt overhead
  return total;
}

/**
 * Checks if adding a new message would exceed the budget.
 * @param {number} currentTotal 
 * @param {string} nextText 
 * @param {number} budget 
 * @returns {boolean}
 */
export function withinBudget(currentTotal, nextText, budget) {
  return (currentTotal + countTokens(nextText)) <= budget;
}
