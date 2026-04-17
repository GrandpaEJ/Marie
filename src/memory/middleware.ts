// Memory Middleware — auto-wires a Memory instance into the agent pipeline.
// Before each LLM call: injects LTM facts + STM summary as history.
// After each LLM call: extracts new facts from the conversation.

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
      // Find the latest user message from ctx.messages for relevance-based retrieval
      for (let i = ctx.messages.length - 1; i >= 0; i--) {
        if (ctx.messages[i].role === 'user') {
          lastUserQuery = ctx.messages[i].content ?? ''
          break
        }
      }

      // Get the memory context to inject as history (LTM facts + STM summaries)
      const memoryContext = memory.getContext(lastUserQuery)
      if (memoryContext.length === 0) return

      // Inject memory context AFTER the system prompt but BEFORE the main conversation.
      // ctx.messages structure: [system, ...history, user_message]
      // We insert memory context between system and the rest.
      const systemMessages = ctx.messages.filter(m => m.role === 'system')
      const conversationMessages = ctx.messages.filter(m => m.role !== 'system')

      ctx.messages.length = 0  // clear in place to avoid reference issues
      ctx.messages.push(...systemMessages, ...memoryContext, ...conversationMessages)
    },

    async after(ctx: MiddlewareContext) {
      // Only process on the final step (no tool calls pending)
      // We look at the last assistant message in ctx.messages
      const lastAssistant = [...ctx.messages].reverse().find(m => m.role === 'assistant')
      const lastUser = [...ctx.messages].reverse().find(m => m.role === 'user' && m.content && !m.content.startsWith('['))

      if (lastUser) {
        // Build messages to feed into addTurn
        const userMsg: Message = lastUser
        const assistantMsg: Message = lastAssistant ?? { role: 'assistant', content: '' }

        if (extractFromAssistant) {
          await memory.addTurn(userMsg, assistantMsg)
        } else {
          // Only extract from user side (default — cheaper)
          await memory.add(userMsg)
          memory['stm'].add(assistantMsg)
          await memory['stm'].consolidate()
        }
      }
    },
  }
}
