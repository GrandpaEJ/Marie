// Reasoning modes: Chain-of-Thought, Reflexion, ReAct
// Enables step-by-step reasoning, self-correction, and planning

import type { Message, Middleware, MiddlewareContext } from './types.ts'

export type ReasoningMode = 'direct' | 'cot' | 'reflexion' | 'react'

export interface ReasoningOptions {
  mode: ReasoningMode
  maxIterations?: number
  verificationPrompt?: string
}

export interface ReasoningState {
  mode: ReasoningMode
  thoughts: string[]
  reflections: string[]
  iterations: number
}

// Pre-built reasoning prompts
const COT_PROMPT = `Before answering, think step-by-step. Show your reasoning process.`

const REFLECTION_PROMPT = `After providing your answer, reflect on:
1. Is this answer correct? Why or why not?
2. What could be improved?
3. What am I uncertain about?`

const REACT_PROMPT = `Use the following format:
Thought: what I'm thinking
Action: tool name (if needed)
Observation: result of action
... (repeat as needed)
Answer: final answer`

// Create reasoning middleware
export function createReasoningMiddleware(opts: ReasoningOptions): Middleware & { state: ReasoningState } {
  const state: ReasoningState = {
    mode: opts.mode,
    thoughts: [],
    reflections: [],
    iterations: 0,
  }

  return {
    name: 'reasoning',
    state,

    async before(ctx: MiddlewareContext) {
      if (ctx.step > 0) return // Only on first step

      state.iterations++
      if (opts.maxIterations && state.iterations > opts.maxIterations) {
        throw new Error(`Max reasoning iterations (${opts.maxIterations}) exceeded`)
      }

      // Inject reasoning guidance into system context
      let reasoningHint = ''

      switch (opts.mode) {
        case 'cot':
          reasoningHint = COT_PROMPT
          break
        case 'reflexion':
          reasoningHint = `${COT_PROMPT}\n\n${REFLECTION_PROMPT}`
          break
        case 'react':
          reasoningHint = REACT_PROMPT
          break
        case 'direct':
        default:
          return // No modification needed
      }

      // Find or create a reasoning message
      const hasReasoning = ctx.messages.some(m =>
        m.role === 'system' && (m.content as string).includes('Think step-by-step')
      )

      if (!hasReasoning) {
        // Add reasoning instruction after system prompt
        const idx = ctx.messages.findIndex(m => m.role === 'user')
        ctx.messages.splice(idx, 0, {
          role: 'system',
          content: reasoningHint,
        } as Message)
      }
    },

    async after(ctx: MiddlewareContext) {
      // Extract thoughts from the last assistant message if CoT mode
      if (opts.mode === 'cot' || opts.mode === 'reflexion') {
        const lastAssistant = ctx.messages.filter(m => m.role === 'assistant').pop()
        if (lastAssistant?.content) {
          // Look for "step 1:", "thinking:", "thought:" patterns
          const thoughtPattern = /(?:step \d+:|thinking:|thought:)(.+?)(?=(?:step \d+:|thinking:|answer:)|$)/gi
          const matches = [...(lastAssistant.content as string).matchAll(thoughtPattern)]
          for (const match of matches) {
            if (match[1]?.trim()) state.thoughts.push(match[1].trim())
          }
        }
      }
    },
  }
}

// Plan decomposition utility
export async function decomposeTask(
  client: { chat: (msg: string) => Promise<string> },
  task: string
): Promise<string[]> {
  const response = await client.chat(
    `Break down this task into specific, actionable steps:\n\n${task}\n\n` +
    `Format: One step per line, numbered 1, 2, 3, etc.`
  )

  // Parse numbered steps
  const steps = response
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(line => line.length > 0 && line.length < 500)

  return steps
}

// Self-verification utility
export async function verifyAnswer(
  client: { chat: (msg: string) => Promise<string> },
  question: string,
  answer: string,
  verificationPrompt?: string
): Promise<{ verified: boolean; confidence: number; feedback: string }> {
  const prompt = verificationPrompt || 'Verify if this answer is correct.'

  const response = await client.chat(
    `${prompt}\n\nQuestion: ${question}\n\nAnswer: ${answer}\n\n` +
    `Respond with:\nVERIFIED: yes/no\nCONFIDENCE: 0-100\nFEEDBACK: brief explanation`
  )

  const verified = response.toLowerCase().includes('verified: yes')
  const confidenceMatch = response.match(/confidence:\s*(\d+)/i)
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 50

  return {
    verified,
    confidence,
    feedback: response,
  }
}