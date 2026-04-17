// Structured JSON logging middleware.
// Logs every LLM call start/end and every tool invocation.
// Output: one JSON object per line → works with any log aggregator (Loki, Datadog, etc.)

import type { Middleware, MiddlewareContext } from '../types.ts'

export interface LoggerOptions {
  // Write destination — defaults to stderr (keeps stdout clean for app output)
  write?: (line: string) => void
  // Minimum log level: 'debug' | 'info' | 'warn'
  level?: 'debug' | 'info' | 'warn'
  // Tag all log lines with extra fields
  context?: Record<string, unknown>
}

function now() {
  return new Date().toISOString()
}

export function createLogger(opts: LoggerOptions = {}): Middleware {
  const write = opts.write ?? ((line: string) => Bun.write(Bun.stderr, line + '\n'))
  const extra = opts.context ?? {}

  const log = (event: string, data: Record<string, unknown>) => {
    write(JSON.stringify({ ts: now(), event, ...extra, ...data }))
  }

  return {
    name: 'logger',

    before(ctx: MiddlewareContext) {
      log('llm:start', {
        model: ctx.model,
        step: ctx.step,
        messages: ctx.messages.length,
        cached: ctx.cached,
      })
    },

    after(ctx: MiddlewareContext) {
      log('llm:end', {
        model: ctx.model,
        step: ctx.step,
        tokens: ctx.usage,
        costUsd: ctx.costUsd,
        latencyMs: Date.now() - ctx.startedAt,
        cached: ctx.cached,
      })
    },

    onError(ctx: MiddlewareContext, err: Error) {
      log('llm:error', {
        model: ctx.model,
        step: ctx.step,
        error: err.message,
        code: (err as any).code,
      })
    },
  }
}
