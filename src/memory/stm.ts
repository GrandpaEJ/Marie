// Short-Term Memory — conversation window with multi-strategy summarization.
// Keeps recent turns verbatim. Compresses older turns into bullets/paragraphs.
// v1.1: Added multi-user scoping via Map<userId, Buffer>.

import type { Message } from '../types.ts'
import type { SummaryStrategy } from './types.ts'

const DEFAULT_USER = 'default'

// ── Default summarizers ─────────────────────────────────────────────────────
// These are heuristic-only (zero LLM cost) and are overrideable.

function defaultBulletSummarize(messages: Message[]): string {
  const points: string[] = []
  for (const m of messages) {
    if (!m.content) continue
    const role = m.role === 'user' ? 'User' : 'Assistant'
    // Trim long messages to first sentence for brevity
    const snippet = m.content.slice(0, 120).replace(/\n+/g, ' ')
    const trimmed = snippet.length < m.content.length ? snippet + '…' : snippet
    points.push(`• [${role}]: ${trimmed}`)
  }
  return points.join('\n')
}

function defaultParagraphSummarize(messages: Message[]): string {
  const parts: string[] = []
  for (const m of messages) {
    if (!m.content) continue
    parts.push(m.content.slice(0, 80).replace(/\n+/g, ' '))
  }
  return 'Earlier conversation: ' + parts.join(' | ')
}

// ── STM ─────────────────────────────────────────────────────────────────────

export interface STMOptions {
  recentTurns?: number            // raw turns to keep verbatim (default: 8)
  strategy?: SummaryStrategy      // how to compress old turns (default: 'bullet')
  maxSummaries?: number           // max summaries before oldest is forgotten (default: 3)
  summarize?: (messages: Message[]) => Promise<string>  // override (use a cheap LLM)
}

export class STM {
  private rawBuffers = new Map<string, Message[]>()       // userId -> Message[]
  private summaryBuffers = new Map<string, string[]>()    // userId -> string[]
  
  private recentTurns: number
  private maxSummaries: number
  private strategy: SummaryStrategy
  private customSummarize?: (messages: Message[]) => Promise<string>

  constructor(opts: STMOptions = {}) {
    this.recentTurns = opts.recentTurns ?? 8
    this.maxSummaries = opts.maxSummaries ?? 3
    this.strategy = opts.strategy ?? 'bullet'
    this.customSummarize = opts.summarize
  }

  // ── Scoped accessors ──────────────────────────────────────────────────────

  private getBuffer(userId = DEFAULT_USER): Message[] {
    if (!this.rawBuffers.has(userId)) this.rawBuffers.set(userId, [])
    return this.rawBuffers.get(userId)!
  }

  private getSummaries(userId = DEFAULT_USER): string[] {
    if (!this.summaryBuffers.has(userId)) this.summaryBuffers.set(userId, [])
    return this.summaryBuffers.get(userId)!
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  add(message: Message, userId = DEFAULT_USER): void {
    this.getBuffer(userId).push(message)
  }

  addAll(messages: Message[], userId = DEFAULT_USER): void {
    for (const m of messages) this.add(m, userId)
  }

  // Trigger compression of old turns into a summary paragraph/bullets.
  // Call this at end of each conversation turn.
  async consolidate(userId = DEFAULT_USER): Promise<void> {
    const maxMessages = this.recentTurns * 2  // user + assistant per turn
    const buffer = this.getBuffer(userId)

    if (buffer.length <= maxMessages) return  // not full yet

    const toCompress = buffer.slice(0, -maxMessages)
    const recent = buffer.slice(-maxMessages)
    
    // Update buffer in place
    this.rawBuffers.set(userId, recent)

    let summary: string
    if (this.customSummarize) {
      try {
        summary = await this.customSummarize(toCompress)
      } catch {
        // Fallback to heuristic if LLM fails
        summary = this.heuristicSummarize(toCompress)
      }
    } else {
      summary = this.heuristicSummarize(toCompress)
    }

    const summaries = this.getSummaries(userId)
    summaries.push(summary)

    // Token reduction: gracefully forget oldest context if we exceed capacity
    if (summaries.length > this.maxSummaries) {
      summaries.shift()
    }
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  // Returns the full history to inject as `opts.history` in agent.chat()
  // Format: [summary injection messages] + [raw recent messages]
  getHistory(userId = DEFAULT_USER): Message[] {
    const result: Message[] = []
    const summaries = this.getSummaries(userId)
    const buffer = this.getBuffer(userId)

    if (summaries.length > 0) {
      const merged = summaries.join('\n\n---\n\n')
      result.push({
        role: 'user',
        content: `[Conversation History Summary]:\n${merged}`,
      })
      result.push({
        role: 'assistant',
        content: 'I have reviewed the conversation history summary.',
      })
    }

    result.push(...buffer)
    return result
  }

  // Raw buffer only (for inspection/extraction)
  getRaw(userId = DEFAULT_USER): Message[] {
    return this.getBuffer(userId).slice()
  }

  getAllSummaries(userId = DEFAULT_USER): string[] {
    return this.getSummaries(userId).slice()
  }

  // Restore from persistence. We assume snapshot handles userId mapping.
  restore(userId: string, rawBuffer: Message[], summaries: string[]): void {
    this.rawBuffers.set(userId, rawBuffer)
    this.summaryBuffers.set(userId, summaries)
  }

  clear(userId = DEFAULT_USER): void {
    this.rawBuffers.set(userId, [])
    this.summaryBuffers.set(userId, [])
  }

  rawLength(userId = DEFAULT_USER): number {
    return this.getBuffer(userId).length
  }

  // Returns all user IDs currently in memory
  getUserIds(): string[] {
    return [...this.rawBuffers.keys()]
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private heuristicSummarize(messages: Message[]): string {
    if (this.strategy === 'paragraph') {
      return defaultParagraphSummarize(messages)
    } else if (this.strategy === 'hybrid') {
      // Bullet points for facts, paragraph wrap for context
      const bullets = defaultBulletSummarize(messages)
      return `Conversation snapshot:\n${bullets}`
    } else {
      return defaultBulletSummarize(messages)
    }
  }
}
