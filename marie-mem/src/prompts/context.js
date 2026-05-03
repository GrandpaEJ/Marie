/**
 * Builds the Context section of the system prompt.
 * Includes time, session info, and user facts.
 */
export function buildContextSection(userFacts, sessionContext) {
  const now = new Date();
  const dhakaTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(now);

  let content = `[CONTEXT]
Current Local Time (Asia/Dhaka): ${dhakaTime}
`;

  if (sessionContext) {
    content += `\n[SESSION]\n${sessionContext}\n`;
  }

  if (userFacts) {
    content += `\n[USER MEMORY]\n${userFacts}\n`;
  }

  return content;
}
