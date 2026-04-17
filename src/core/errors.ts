// Typed error classes for Silvi.
// Every error has a machine-readable `code` and structured payload.
// Catch with: catch (e) { if (e instanceof BudgetExceededError) ... }

export class SilviError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'SilviError'
    this.code = code
  }
}

// ── LLM / Network ──────────────────────────────────────────────────────────

export class LLMError extends SilviError {
  readonly status: number
  readonly provider: string
  readonly retryable: boolean

  constructor(opts: { status: number; provider: string; body: string; retryable?: boolean }) {
    super(`LLM error ${opts.status} from ${opts.provider}: ${opts.body}`, 'LLM_ERROR')
    this.name = 'LLMError'
    this.status = opts.status
    this.provider = opts.provider
    this.retryable = opts.retryable ?? (opts.status === 429 || opts.status >= 500)
  }
}

export class LLMTimeoutError extends SilviError {
  readonly timeoutMs: number
  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`, 'LLM_TIMEOUT')
    this.name = 'LLMTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

// ── Budget ─────────────────────────────────────────────────────────────────

export class BudgetExceededError extends SilviError {
  readonly kind: 'tokens' | 'cost' | 'duration' | 'steps'
  readonly used: number
  readonly limit: number

  constructor(opts: { kind: BudgetExceededError['kind']; used: number; limit: number }) {
    const units = opts.kind === 'cost' ? 'USD' : opts.kind === 'duration' ? 'ms' : ''
    super(
      `Budget exceeded: ${opts.kind} used=${opts.used}${units} limit=${opts.limit}${units}`,
      'BUDGET_EXCEEDED',
    )
    this.name = 'BudgetExceededError'
    this.kind = opts.kind
    this.used = opts.used
    this.limit = opts.limit
  }
}

// ── Tools ──────────────────────────────────────────────────────────────────

export class ToolTimeoutError extends SilviError {
  readonly toolName: string
  readonly timeoutMs: number

  constructor(toolName: string, timeoutMs: number) {
    super(`Tool "${toolName}" timed out after ${timeoutMs}ms`, 'TOOL_TIMEOUT')
    this.name = 'ToolTimeoutError'
    this.toolName = toolName
    this.timeoutMs = timeoutMs
  }
}

export class ToolValidationError extends SilviError {
  readonly toolName: string
  readonly paramErrors: string

  constructor(toolName: string, paramErrors: string) {
    super(`Tool "${toolName}" param validation failed: ${paramErrors}`, 'TOOL_VALIDATION')
    this.name = 'ToolValidationError'
    this.toolName = toolName
    this.paramErrors = paramErrors
  }
}

export class SafeModeError extends SilviError {
  readonly toolName: string
  constructor(toolName: string) {
    super(`Tool "${toolName}" is blocked in safe mode`, 'SAFE_MODE')
    this.name = 'SafeModeError'
    this.toolName = toolName
  }
}
