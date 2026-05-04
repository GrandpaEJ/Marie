/**
 * Output Guard: Redacts sensitive information from LLM responses before they reach the user.
 */
export const outputGuard = async (ctx, next) => {
  // We need to wrap the response after the handler executes
  await next();

  if (ctx.response && ctx.response.content) {
    let content = ctx.response.content;

    // 1. Redact API Keys & Secrets
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{32,}/g,           // OpenAI
      /ghp_[a-zA-Z0-9]{36}/g,           // GitHub
      /[a-zA-Z0-9]{20,}:[a-zA-Z0-9]{40,}/g // Generic Key:Secret
    ];

    for (const pattern of secretPatterns) {
      content = content.replace(pattern, '[REDACTED]');
    }

    // 2. Redact Sensitive Paths
    const pathPatterns = [
      /\/etc\/(passwd|shadow|group)/g,
      /\/root\//g,
      /\/home\/[^\/]+\/\.ssh/g
    ];

    for (const pattern of pathPatterns) {
      content = content.replace(pattern, '[REDACTED_PATH]');
    }

    ctx.response.content = content;
  }
};
