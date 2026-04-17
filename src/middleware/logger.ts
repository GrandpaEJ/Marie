// Colorful, managed logging middleware.
// Supports pretty terminal output (ANSI) and structured JSON fallback.
// Displays real-time cumulative token usage and cost.

import type { Middleware, MiddlewareContext } from '../types.ts'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerOptions {
  // Write destination — defaults to stderr
  write?: (line: string) => void
  // Minimum log level (default: 'info')
  level?: LogLevel
  // Force pretty output (default: auto-detect TTY)
  pretty?: boolean
  // Tag all log lines with extra fields
  context?: Record<string, unknown>
}

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export function createLogger(opts: LoggerOptions = {}): Middleware {
  const minLevel = opts.level ?? 'info'
  const isTTY = opts.pretty ?? (process.stderr.isTTY || false)
  const write = opts.write ?? ((line: string) => Bun.write(Bun.stderr, line + '\n'))
  const extraContext = opts.context ?? {}

  const shouldLog = (level: LogLevel) => LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel]

  const formatTokens = (total: number, cost: number) => {
    return `${COLORS.green}${total}${COLORS.dim} tokens ($${cost.toFixed(4)})${COLORS.reset}`
  }

  const prettyLog = (level: LogLevel, event: string, msg: string, ctx?: MiddlewareContext) => {
    if (!shouldLog(level)) return

    const time = new Date().toLocaleTimeString()
    const levelStr = level.toUpperCase().padEnd(5)
    
    let line = `${COLORS.gray}[${time}]${COLORS.reset} `
    
    // Level color
    if (level === 'error') line += `${COLORS.red}${COLORS.bold}${levelStr}${COLORS.reset} `
    else if (level === 'warn') line += `${COLORS.yellow}${levelStr}${COLORS.reset} `
    else if (level === 'debug') line += `${COLORS.blue}${levelStr}${COLORS.reset} `
    else line += `${COLORS.cyan}${levelStr}${COLORS.reset} `

    line += `${COLORS.bold}${event.padEnd(10)}${COLORS.reset} │ ${msg}`

    if (ctx) {
      const stats = ` (${formatTokens(ctx.totalUsage.total, ctx.totalCostUsd)})`
      line += stats
    }

    write(line)
  }

  const jsonLog = (level: LogLevel, event: string, data: Record<string, unknown>) => {
    if (!shouldLog(level)) return
    write(JSON.stringify({ ts: new Date().toISOString(), level, event, ...extraContext, ...data }))
  }

  return {
    name: 'logger',

    before(ctx: MiddlewareContext) {
      if (isTTY) {
        prettyLog('debug', 'llm:start', `Step ${ctx.step} → ${COLORS.bold}${ctx.model}${COLORS.reset}`, ctx)
      } else {
        jsonLog('info', 'llm:start', { model: ctx.model, step: ctx.step, cached: ctx.cached })
      }
    },

    after(ctx: MiddlewareContext) {
      if (isTTY) {
        const cachedStr = ctx.cached ? `${COLORS.green}[CACHED]${COLORS.reset} ` : ''
        prettyLog('info', 'llm:end', `${cachedStr}Response complete in ${Date.now() - ctx.startedAt}ms`, ctx)
      } else {
        jsonLog('info', 'llm:end', {
          model: ctx.model,
          step: ctx.step,
          usage: ctx.usage,
          totalUsage: ctx.totalUsage,
          costUsd: ctx.costUsd,
          totalCostUsd: ctx.totalCostUsd,
          latencyMs: Date.now() - ctx.startedAt,
          cached: ctx.cached,
        })
      }
    },

    onError(ctx: MiddlewareContext, err: Error) {
      if (isTTY) {
        prettyLog('error', 'llm:error', `${COLORS.red}${err.message}${COLORS.reset}`, ctx)
      } else {
        jsonLog('error', 'llm:error', { error: err.message, step: ctx.step })
      }
    },
  }
}
