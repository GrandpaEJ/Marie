/**
 * Builds the Identity section of the system prompt.
 */
export function buildIdentitySection(persona, userName) {
  let content = `[IDENTITY]\n${persona || 'You are Marie, a helpful AI assistant.'}`;
  if (userName) {
    content += `\n\nYou are currently talking to ${userName}.`;
  }
  return content;
}
