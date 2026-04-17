// Memory Manager — Central hub orchestrating STM, LTM, Cache, and Extraction.
// Single entry point for all memory operations.

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
      strategy: opts.summaryStrategy ?? 'bullet',
      summarize: opts.summarize,
    })

    this.ltm = new LTM(opts.maxLtmNodes ?? 1000)
    this.extract = createExtractor(opts.extract)
  }

  // ── Ingestion ─────────────────────────────────────────────────────────────

  // Add a single message to STM and extract facts into LTM
  async add(message: Message): Promise<void> {
    this.stm.add(message)

    // Extract facts from user messages (assistants don't reveal user facts)
    if (message.content && message.role === 'user') {
      const facts = await this.extract(message.content)
      for (const fact of facts) {
        if (!this.cfg.categories || this.cfg.categories.includes(fact.category)) {
          this.ltm.add(fact)
        }
      }
    }
  }

  // Add a user + assistant exchange and trigger STM consolidation
  async addTurn(userMsg: Message, assistantMsg: Message): Promise<void> {
    await this.add(userMsg)
    await this.add(assistantMsg)
    await this.stm.consolidate()
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  // Query LTM only (for specific fact lookup)
  query(text: string, opts?: MemoryQueryOptions): MemoryNode[] {
    return this.ltm.query(text, opts)
  }

  // Build the complete history to inject into the next agent.chat() call.
  // Layout: [LTM injection block] + [STM summary messages] + [raw recent turns]
  getContext(currentQuery?: string): Message[] {
    const result: Message[] = []

    // 1. Inject relevant LTM facts (if a query is provided for relevance-based lookup)
    const facts = currentQuery
      ? this.ltm.query(currentQuery, { limit: this.cfg.maxContextFacts })
      : this.ltm.all().slice(0, this.cfg.maxContextFacts)

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

    // 2. Include STM (summaries + raw recent buffer)
    result.push(...this.stm.getHistory())

    return result
  }

  // ── Direct LTM Control ────────────────────────────────────────────────────

  // Manually add a fact to LTM (e.g. from onboarding flow)
  remember(content: string, category: MemoryNode['category'], importance = 7, tags: string[] = []): MemoryNode {
    return this.ltm.add({ content, category, importance, tags, source: 'heuristic' })
  }

  // Delete a specific LTM fact by id
  forget(id: string): void {
    this.ltm.delete(id)
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (!this.cfg.persist) return
    const snapshot: MemorySnapshot = {
      ltm: this.ltm.all(),
      stmSummaries: this.stm.getSummaries(),
      savedAt: Date.now(),
    }
    await this.cfg.persist.save(snapshot)
  }

  async load(): Promise<boolean> {
    if (!this.cfg.persist) return false
    const snapshot = await this.cfg.persist.load()
    if (!snapshot) return false

    // Restore LTM
    for (const node of snapshot.ltm) {
      this.ltm.add({
        content: node.content,
        category: node.category,
        importance: node.importance,
        tags: node.tags,
        source: node.source,
      })
    }

    // Restore STM summaries (not raw buffer — that was last session)
    this.stm.restore([], snapshot.stmSummaries)

    return true
  }

  // ── Stats & Debug ─────────────────────────────────────────────────────────

  get stats() {
    return {
      ltmNodes: this.ltm.size,
      stmRaw: this.stm.rawLength,
    }
  }

  clearAll(): void {
    this.stm.clear()
    this.ltm.clear()
  }
}
