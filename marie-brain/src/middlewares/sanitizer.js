/**
 * Sanitizer Middleware: Protects against prompt injection and malicious input patterns.
 */
export const sanitizer = async (ctx, next) => {
  const { event } = ctx;
  const body = event.body || '';

  // 1. Prompt Injection Patterns
  const injectionPatterns = [
    /ignore all previous instructions/i,
    /you are now DAN/i,
    /system:\s/i,
    /<\|endoftext\|>/i,
    /TOOLCALL>/i
  ];

  let isInjected = false;
  for (const pattern of injectionPatterns) {
    if (pattern.test(body)) {
      isInjected = true;
      break;
    }
  }

  if (isInjected) {
    console.warn(`[Security] Potential prompt injection detected from ${event.senderID}: ${body}`);
    // Strip the dangerous parts or abort
    // For now, we'll just log it and proceed with a warning added to the context
    ctx.securityWarning = 'Potential injection detected';
  }

  // 2. Argument Sanitization Helper
  ctx.sanitizeArgs = (args) => {
    const forbiddenStrings = ['../', '/etc/', '/root/', 'C:\\Windows\\', '; rm ', '&& cat', '| grep'];
    const argsString = JSON.stringify(args);
    
    for (const forbidden of forbiddenStrings) {
      if (argsString.includes(forbidden)) {
        throw new Error(`Security Violation: Forbidden pattern "${forbidden}" found in tool arguments.`);
      }
    }
    return args;
  };

  await next();
};
