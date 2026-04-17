// Marie Memory — Core Types
// All shared interfaces for the memory system.

import type { Message } from '../types.ts'

// ── Fact Categories ────────────────────────────────────────────────────────

export type FactCategory =
  | 'fact'        // general knowledge ("User is a TypeScript developer")
  | 'name'        // people & relationships ("brother = Arif")
  | 'preference'  // likes/dislikes ("prefers dark mode")
  | 'location'    // places ("lives in Dhaka")
  | 'niche'       // domain-specific ("runs a panel called Pterobill")

// ── Memory Node ─────────────────────────────────────────────────────────────

export interface MemoryNode {
  id: string
  content: string
  category: FactCategory
  importance: number           // 1–10 (higher = surfaces first in retrieval)
  createdAt: number            // epoch ms
  lastAccessedAt: number       // updated on every retrieval (for recency decay)
  accessCount: number          // number of times retrieved
  tags: string[]               // searchable labels derived from content
  source: 'heuristic' | 'llm' // how was the fact extracted?
}

// ── Summary Strategies ──────────────────────────────────────────────────────

export type SummaryStrategy = 'bullet' | 'paragraph' | 'hybrid'

// ── Persistence Adapter ─────────────────────────────────────────────────────

export interface MemorySnapshot {
  ltm: MemoryNode[]
  stmSummaries: string[]
  savedAt: number
}

export interface MemoryPersist {
  save(snapshot: MemorySnapshot): Promise<void>
  load(): Promise<MemorySnapshot | null>
}

// ── Memory Config ───────────────────────────────────────────────────────────

export interface MemoryConfig {
  // STM
  recentTurns?: number           // keep N recent turns verbatim (default: 8)
  summaryStrategy?: SummaryStrategy

  // LTM
  categories?: FactCategory[]    // which categories to extract (default: all)
  maxLtmNodes?: number           // max nodes before pruning low-importance ones (default: 1000)

  // Persistence
  persist?: MemoryPersist

  // Injection
  maxContextFacts?: number       // max LTM facts injected per turn (default: 5)
  contextPreamble?: string       // prefix for injected memory block (default built-in)

  // Custom processors (use cheap models)
  summarize?: (messages: Message[]) => Promise<string>
  extract?: (text: string) => Promise<Array<Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>>>
}

// ── Query Options ───────────────────────────────────────────────────────────

export interface MemoryQueryOptions {
  category?: FactCategory        // filter by category
  limit?: number                 // max results (default: 5)
  minImportance?: number         // filter by minimum importance
  recencyBias?: number           // 0 = pure relevance, 1 = pure recency (default: 0.3)
}
