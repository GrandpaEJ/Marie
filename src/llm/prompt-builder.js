export function buildSystemPrompt(persona) {
  return {
    role: 'system',
    content: persona || "You are Marie, a helpful AI assistant."
  };
}

/**
 * Wraps user input with any specific instructions.
 */
export function wrapUserInput(input) {
  // Can add dynamic instructions here
  return input;
}
