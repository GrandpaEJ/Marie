// Sliding-window conversation memory with automatic summarization.
// Keeps recent turns in full, compresses older turns into a summary paragraph.
// This prevents "context explosion" in long conversations.

import type { Message } from '../types.ts'

export interface SlidingWindowOptions {
  // Keep this many recent turns in full (a turn = user + assistant pair)
  recentTurns?: number    // default: 10
  // Target max tokens for the compressed summary (very approximate)
  summaryMaxWords?: number // default: 200
  // Async function to summarize old messages (use a cheap model)
  summarize?: (messages: Message[]) => Promise<string>
}

export class SlidingWindowMemory {
  private fullHistory: Message[] = []
  private summary: string | null = null
  private recentTurns: number
  private summaryMaxWords: number
  private summarize?: (messages: Message[]) => Promise<string>

  constructor(opts: SlidingWindowOptions = {}) {
    this.recentTurns = opts.recentTurns ?? 10
    this.summaryMaxWords = opts.summaryMaxWords ?? 200
    this.summarize = opts.summarize
  }

  // Add a message to memory
  add(message: Message): void {
    this.fullHistory.push(message)
  }

  // Add multiple messages
  addAll(messages: Message[]): void {
    for (const m of messages) this.add(m)
  }

  // Returns the message list to inject as history for the next agent call.
  // If auto-compression is enabled, triggers summarization when needed.
  async getHistory(): Promise<Message[]> {
    const maxMessages = this.recentTurns * 2  // user + assistant per turn

    if (this.fullHistory.length <= maxMessages) {
      // Nothing to compress yet
      return this.fullHistory.slice()
    }

    // Split: old messages to compress + recent to keep verbatim
    const oldMessages = this.fullHistory.slice(0, -maxMessages)
    const recentMessages = this.fullHistory.slice(-maxMessages)

    // Attempt auto-summarization if a summarizer is provided
    if (this.summarize && oldMessages.length > 0) {
      try {
        this.summary = await this.summarize(oldMessages)
        // Trim full history to just the recent window (old ones are now in summary)
        this.fullHistory = recentMessages
      } catch {
        // If summarization fails, fall back to truncation (recent only)
      }
    }

    // Build final history: optional summary injection + recent messages
    const result: Message[] = []

    if (this.summary) {
      result.push({
        role: 'user',
        content: `[Earlier conversation summary]: ${this.summary}`,
      })
      result.push({
        role: 'assistant',
        content: 'Understood. I have context of the earlier conversation.',
      })
    }

    result.push(...(this.fullHistory.length <= maxMessages ? this.fullHistory : recentMessages))
    return result
  }

  // Sync version — no summarization, just window truncation
  getHistorySync(maxMessages?: number): Message[] {
    const limit = maxMessages ?? this.recentTurns * 2
    return this.fullHistory.slice(-limit)
  }

  // Clear all memory
  clear(): void {
    this.fullHistory = []
    this.summary = null
  }

  get length(): number {
    return this.fullHistory.length
  }

  get hasSummary(): boolean {
    return this.summary !== null
  }
}
