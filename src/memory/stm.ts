// Short-Term Memory — conversation window with multi-strategy summarization.
// Keeps recent turns verbatim. Compresses older turns into bullets/paragraphs.

import type { Message } from '../types.ts'
import type { SummaryStrategy } from './types.ts'

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
  private rawBuffer: Message[] = []    // the live conversation turns
  private summaries: string[] = []     // compressed older batches
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

  // ── Write ─────────────────────────────────────────────────────────────────

  add(message: Message): void {
    this.rawBuffer.push(message)
  }

  addAll(messages: Message[]): void {
    for (const m of messages) this.add(m)
  }

  // Trigger compression of old turns into a summary paragraph/bullets.
  // Call this at end of each conversation turn.
  async consolidate(): Promise<void> {
    const maxMessages = this.recentTurns * 2  // user + assistant per turn

    if (this.rawBuffer.length <= maxMessages) return  // not full yet

    const toCompress = this.rawBuffer.slice(0, -maxMessages)
    this.rawBuffer = this.rawBuffer.slice(-maxMessages)

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

    this.summaries.push(summary)

    // Token reduction: gracefully forget oldest context if we exceed capacity
    if (this.summaries.length > this.maxSummaries) {
      this.summaries.shift()
    }
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  // Returns the full history to inject as `opts.history` in agent.chat()
  // Format: [summary injection messages] + [raw recent messages]
  getHistory(): Message[] {
    const result: Message[] = []

    if (this.summaries.length > 0) {
      const merged = this.summaries.join('\n\n---\n\n')
      result.push({
        role: 'user',
        content: `[Conversation History Summary]:\n${merged}`,
      })
      result.push({
        role: 'assistant',
        content: 'I have reviewed the conversation history summary.',
      })
    }

    result.push(...this.rawBuffer)
    return result
  }

  // Raw buffer only (for inspection/extraction)
  getRaw(): Message[] {
    return this.rawBuffer.slice()
  }

  getSummaries(): string[] {
    return this.summaries.slice()
  }

  // Restore from persistence
  restore(rawBuffer: Message[], summaries: string[]): void {
    this.rawBuffer = rawBuffer
    this.summaries = summaries
  }

  clear(): void {
    this.rawBuffer = []
    this.summaries = []
  }

  get rawLength(): number {
    return this.rawBuffer.length
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
