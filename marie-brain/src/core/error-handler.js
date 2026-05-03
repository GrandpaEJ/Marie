/**
 * Classifies tool and LLM errors for recovery strategies.
 */

export const ErrorType = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  AUTH: 'AUTH',
  INVALID_ARGS: 'INVALID_ARGS',
  UNSUPPORTED: 'UNSUPPORTED',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL: 'INTERNAL'
};

/**
 * Parses an error object/message and returns a classified ErrorType.
 */
export function classifyError(error) {
  const msg = (error.message || String(error)).toLowerCase();

  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('etimedout') || msg.includes('network')) {
    return ErrorType.NETWORK;
  }

  if (msg.includes('timeout') || msg.includes('deadline exceeded')) {
    return ErrorType.TIMEOUT;
  }

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return ErrorType.AUTH;
  }

  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return ErrorType.RATE_LIMIT;
  }

  if (msg.includes('invalid arguments') || msg.includes('failed to parse') || msg.includes('unexpected token')) {
    return ErrorType.INVALID_ARGS;
  }

  if (msg.includes('not supported') || msg.includes('no such tool')) {
    return ErrorType.UNSUPPORTED;
  }

  return ErrorType.INTERNAL;
}

/**
 * Returns a strategy for the given error type.
 */
export function getRecoveryStrategy(type) {
  switch (type) {
    case ErrorType.NETWORK:
    case ErrorType.RATE_LIMIT:
      return { action: 'retry', delay: 2000, maxRetries: 1 };
    case ErrorType.TIMEOUT:
      return { action: 'retry', delay: 500, maxRetries: 1 };
    case ErrorType.INVALID_ARGS:
      return { action: 'fix', feedback: true };
    case ErrorType.AUTH:
    case ErrorType.UNSUPPORTED:
      return { action: 'fail', feedback: true };
    default:
      return { action: 'fail', feedback: false };
  }
}
