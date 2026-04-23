import { Message } from './client.js';

/**
 * Optimized System Prompt Builder
 */
export function buildSystemPrompt(persona: string, contextBlocks: string[] = []): string {
  let prompt = persona;
  if (contextBlocks.length > 0) {
    prompt += '\n\n[CONTEXT]\n' + contextBlocks.join('\n---\n');
  }
  return prompt;
}

/**
 * Wraps user input for consistent formatting
 */
export function wrapUserInput(text: string): string {
  return text.trim();
}
