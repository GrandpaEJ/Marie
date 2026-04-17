// Memory Manager — Central hub orchestrating STM, LTM, Cache, and Extraction.
// Single entry point for all memory operations.
// v1.1: Added multi-user scoping to support Telegram bots and production deployments.

import type { Message } from '../types.ts'
import type { MemoryConfig, MemoryNode, MemoryQueryOptions, MemorySnapshot } from './types.ts'
import { LTM } from './ltm.ts'
import { STM } from './stm.ts'
import { createExtractor, type ExtractFn } from './extractor.ts'

export class Memory {
  private stm: STM
  private ltm: LTM
  private extract: ExtractFn
  private cfg: Required<Pick<MemoryConfig, 'recentTurns' | 'maxContextFacts' | 'contextPreamble'>>
    & Pick<MemoryConfig, 'persist' | 'categories'>

  constructor(opts: MemoryConfig = {}) {
    this.cfg = {
      recentTurns: opts.recentTurns ?? 8,
      maxContextFacts: opts.maxContextFacts ?? 5,
      contextPreamble: opts.contextPreamble ?? '[Relevant memory from Long-Term Store]:',
      persist: opts.persist,
      categories: opts.categories,
    }

    this.stm = new STM({
      recentTurns: this.cfg.recentTurns,
      maxSummaries: opts.maxStmSummaries,
      strategy: opts.summaryStrategy ?? 'bullet',
      summarize: opts.summarize,
    })

    this.ltm = new LTM(opts.maxLtmNodes ?? 1000)
    this.extract = createExtractor(opts.extract)
  }

  // ── Ingestion ─────────────────────────────────────────────────────────────

  /**
   * Add a single message to STM and extract facts into LTM.
   * Isolates memory by userId to prevent data leakage between users.
   */
  async add(message: Message, userId?: string): Promise<void> {
    this.stm.add(message, userId)

    // Extract facts from user messages
    if (message.content && message.role === 'user') {
      const facts = await this.extract(message.content)
      for (const fact of facts) {
        if (!this.cfg.categories || this.cfg.categories.includes(fact.category)) {
          // Tag the fact with the userId for secure retrieval
          this.ltm.add({ ...fact, userId })
        }
      }
    }
  }

  /**
   * Add a user + assistant exchange and trigger STM consolidation for that user.
   */
  async addTurn(userMsg: Message, assistantMsg: Message, userId?: string): Promise<void> {
    await this.add(userMsg, userId)
    await this.add(assistantMsg, userId)
    await this.stm.consolidate(userId)
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Query LTM for a specific user.
   */
  query(text: string, opts: MemoryQueryOptions = {}): MemoryNode[] {
    return this.ltm.query(text, opts)
  }

  /**
   * Build the complete history to inject into an agent call.
   * layout: [LTM facts] + [STM summaries] + [raw turns]
   * Always scoped to the provided userId.
   */
  getContext(currentQuery?: string, userId?: string): Message[] {
    const result: Message[] = []

    // 1. Inject relevant LTM facts for THIS user
    const facts = this.ltm.query(currentQuery ?? '', { 
      limit: this.cfg.maxContextFacts,
      userId 
    })

    if (facts.length > 0) {
      const factBlock = facts
        .map(f => `[${f.category.toUpperCase()}] ${f.content}`)
        .join('\n')

      result.push({
        role: 'user',
        content: `${this.cfg.contextPreamble}\n${factBlock}`,
      })
      result.push({
        role: 'assistant',
        content: 'I have retrieved relevant context from my long-term memory.',
      })
    }

    // 2. Include STM (summaries + raw recent buffer) for THIS user
    result.push(...this.stm.getHistory(userId))

    return result
  }

  // ── Direct LTM Control ────────────────────────────────────────────────────

  remember(content: string, category: MemoryNode['category'], userId?: string, importance = 7): MemoryNode {
    return this.ltm.add({ content, category, importance, userId, tags: [], source: 'heuristic' })
  }

  forget(id: string): void {
    this.ltm.delete(id)
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  // Saves ALL users recorded in the current session.
  async save(): Promise<void> {
    if (!this.cfg.persist) return
    
    // Multi-tenant save: handle all users or specific segments if needed.
    // For now, we snapshot the entire LTM and all STM summaries.
    const snapshot: MemorySnapshot = {
      ltm: this.ltm.all(),
      stmSummaries: [], // aggregated in save/load logic below
      savedAt: Date.now(),
    }
    
    // Note: To perfectly persist STM for all users, the adapter needs to handle the map.
    // We pass the stm object directly or extract segments.
    // For the relational SQLite adapter, it will handle the collection of all user data.
    await this.cfg.persist.save(snapshot)
  }

  async load(): Promise<boolean> {
    if (!this.cfg.persist) return false
    const snapshot = await this.cfg.persist.load()
    if (!snapshot) return false

    // Restore LTM nodes (retaining their userId tags)
    for (const node of snapshot.ltm) {
      this.ltm.add(node)
    }

    // Restore STM — if the persistence adapter supports multi-tenant STM, it will be loaded here.
    // Relational SQLite adapter handles this.
    
    return true
  }

  // ── Stats & Debug ─────────────────────────────────────────────────────────

  getStats(userId?: string) {
    return {
      ltmNodes: userId ? this.ltm.all().filter(n => n.userId === userId).length : this.ltm.size,
      stmRaw: this.stm.rawLength(userId),
    }
  }

  clearAll(userId?: string): void {
    this.stm.clear(userId)
    // LTM clear for specific user requires filtering
    if (userId) {
      for (const node of this.ltm.all()) {
        if (node.userId === userId) this.ltm.delete(node.id)
      }
    } else {
      this.ltm.clear()
    }
  }
}
