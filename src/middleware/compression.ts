// Prompt compression middleware
// Intelligently truncates old messages to save tokens

import type { Middleware, MiddlewareContext, Message } from '../types.ts'

export interface CompressionOptions {
  // Max total messages to keep (excluding system)
  maxMessages?: number
  // Keep first N messages of each role
  keepFirstOfRole?: number
  // Compression strategy
  strategy?: 'truncate' | 'first_k' | 'importance'
}

const DEFAULT_MAX_MESSAGES = 20
const DEFAULT_KEEP_FIRST = 3

export function createCompressionMiddleware(opts: CompressionOptions = {}): Middleware {
  const maxMessages = opts.maxMessages ?? DEFAULT_MAX_MESSAGES
  const keepFirst = opts.keepFirstOfRole ?? DEFAULT_KEEP_FIRST
  const strategy = opts.strategy ?? 'truncate'

  return {
    name: 'compression',

    before(ctx: MiddlewareContext) {
      // Don't compress system messages
      const systemMsgs = ctx.messages.filter(m => m.role === 'system')
      const otherMsgs = ctx.messages.filter(m => m.role !== 'system')

      if (otherMsgs.length <= maxMessages) return

      let compressed: Message[]

      switch (strategy) {
        case 'first_k':
          // Keep first N and last N messages
          const first = otherMsgs.slice(0, keepFirst)
          const last = otherMsgs.slice(-keepFirst)
          compressed = [...first, ...last]
          break

        case 'importance':
          // Keep recent + messages with tool calls (likely important)
          const withTools = otherMsgs.filter(m => m.tool_calls)
          const recent = otherMsgs.slice(-maxMessages)
          const important = [...new Map([...withTools, ...recent].map(m => [m.tool_call_id || Math.random(), m])).values()]
          compressed = important.slice(-maxMessages)
          break

        case 'truncate':
        default:
          // Just keep the most recent
          compressed = otherMsgs.slice(-maxMessages)
          break
      }

      ctx.messages.length = 0
      ctx.messages.push(...systemMsgs, ...compressed)
    },
  }
}

// Tool result compression - truncate long tool outputs
export function compressToolResult(result: string, maxLength: number = 4000): string {
  if (result.length <= maxLength) return result

  const truncated = result.slice(0, maxLength)
  const remaining = result.length - maxLength

  return `${truncated}\n\n[Output truncated - ${remaining} more characters]`
}

// Batch multiple tool results into single message
export function compressToolBatch(results: Array<{ name: string; result: string }>): string {
  return results
    .map(({ name, result }) => `[${name}]: ${result.slice(0, 1000)}`)
    .join('\n---\n')
}