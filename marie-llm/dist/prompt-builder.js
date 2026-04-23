/**
 * Optimized System Prompt Builder
 */
export function buildSystemPrompt(persona, contextBlocks = []) {
    let prompt = persona;
    if (contextBlocks.length > 0) {
        prompt += '\n\n[CONTEXT]\n' + contextBlocks.join('\n---\n');
    }
    return prompt;
}
/**
 * Wraps user input for consistent formatting
 */
export function wrapUserInput(text) {
    return text.trim();
}
//# sourceMappingURL=prompt-builder.js.map