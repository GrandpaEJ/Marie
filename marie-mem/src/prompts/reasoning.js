/**
 * Builds the Reasoning Protocol section.
 * Instructs the model to use <thought> and <plan> tags.
 */
export function buildReasoningProtocol() {
  return `[REASONING PROTOCOL]
Before answering complex questions or using tools:
1. Wrap your internal reasoning in <thought>...</thought> tags.
2. If a task requires multiple steps, wrap your plan in <plan>...</plan> tags.
3. After getting tool results, reflect: did this answer the question? Wrap reflections in <thought> tags.
4. Only then write your final user-facing response.

Internal monologue (<thought>, <plan>) will be hidden from the user.`;
}
