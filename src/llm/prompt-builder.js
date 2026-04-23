/**
 * Builds a multi-section system prompt for Marie.
 * Includes identity, user awareness, and memory context instructions.
 */
export function buildSystemPrompt(persona, options = {}) {
  let content = persona || "You are Marie, a helpful AI assistant.";

  // Add memory-awareness instructions
  content += `\n
[Instructions for memory continuity]
- You have memory of past conversations stored in [Memory] blocks above.
- Use facts you remember about the user naturally in conversation (don't list them).
- If you learn something new about the user (name, age, preferences, etc.), weave it into your responses naturally.
- Previous conversation summaries give you context about what happened before — reference them naturally if relevant.
- Stay in character at all times.`;

  return {
    role: 'system',
    content
  };
}

/**
 * Wraps user input with any specific instructions.
 */
export function wrapUserInput(input) {
  return input;
}
