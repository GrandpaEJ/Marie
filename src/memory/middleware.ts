// Memory Middleware — auto-wires a Memory instance into the agent pipeline.
// Before each LLM call: injects LTM facts + STM summary as history.
// After each LLM call: extracts new facts from the conversation.
// v1.1: Supports multi-user isolation by reading userId from ctx.metadata.

import type { Middleware, MiddlewareContext, Message } from '../types.ts'
import type { Memory } from './memory.ts'

export interface MemoryMiddlewareOptions {
  memory: Memory
  // If true, also extract facts from assistant responses (default: false)
  extractFromAssistant?: boolean
}

export function createMemoryMiddleware(
  memoryOrOpts: Memory | MemoryMiddlewareOptions,
): Middleware {
  const { memory, extractFromAssistant = false } =
    'memory' in memoryOrOpts
      ? memoryOrOpts
      : { memory: memoryOrOpts, extractFromAssistant: false }

  // Capture the last user message so we can use it for relevance-based LTM retrieval
  let lastUserQuery = ''

  return {
    name: 'memory',

    before(ctx: MiddlewareContext) {
      // 1. Identify owner (userId) from metadata (provided by adapter e.g. Telegram)
      const userId = ctx.metadata?.userId as string | undefined

      // 2. Find the latest user message for relevance-based retrieval
      for (let i = ctx.messages.length - 1; i >= 0; i--) {
        if (ctx.messages[i].role === 'user') {
          lastUserQuery = ctx.messages[i].content ?? ''
          break
        }
      }

      // 3. Get the user-specific memory context (LTM facts + STM summaries)
      const memoryContext = memory.getContext(lastUserQuery, userId)
      if (memoryContext.length === 0) return

      // 4. Inject memory context AFTER the system prompt but BEFORE the main conversation.
      const systemMessages = ctx.messages.filter(m => m.role === 'system')
      const conversationMessages = ctx.messages.filter(m => m.role !== 'system')

      ctx.messages.length = 0  // clear in place to avoid reference issues
      ctx.messages.push(...systemMessages, ...memoryContext, ...conversationMessages)
    },

    async after(ctx: MiddlewareContext) {
      const userId = ctx.metadata?.userId as string | undefined

      // We look at the last assistant message in ctx.messages
      const lastAssistant = [...ctx.messages].reverse().find(m => m.role === 'assistant')
      const lastUser = [...ctx.messages].reverse().find(m => m.role === 'user' && m.content && !m.content.startsWith('['))

      if (lastUser) {
        const userMsg: Message = lastUser
        const assistantMsg: Message = lastAssistant ?? { role: 'assistant', content: '' }

        if (extractFromAssistant) {
          await memory.addTurn(userMsg, assistantMsg, userId)
        } else {
          // Only extract from user side (default)
          await memory.add(userMsg, userId)
          memory['stm'].add(assistantMsg, userId)
          await memory['stm'].consolidate(userId)
        }
        
        // Auto-save to persistence after each turn if configured
        await memory.save()
      }
    },
  }
}
