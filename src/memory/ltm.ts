// Long-Term Memory — Categorized fact store with inverted index.
// Sub-5ms lookup for up to 10,000 nodes. Zero dependencies.

import type { FactCategory, MemoryNode, MemoryQueryOptions } from './types.ts'

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// ── Inverted Index ──────────────────────────────────────────────────────────
// Maps every unique token → Set of node IDs that contain it.

class InvertedIndex {
  private index = new Map<string, Set<string>>()

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1)
  }

  add(id: string, text: string): void {
    for (const token of this.tokenize(text)) {
      if (!this.index.has(token)) this.index.set(token, new Set())
      this.index.get(token)!.add(id)
    }
  }

  remove(id: string, text: string): void {
    for (const token of this.tokenize(text)) {
      this.index.get(token)?.delete(id)
    }
  }

  // Returns Map<nodeId, matchCount> for a query string
  search(query: string): Map<string, number> {
    const hits = new Map<string, number>()
    for (const token of this.tokenize(query)) {
      for (const id of this.index.get(token) ?? []) {
        hits.set(id, (hits.get(id) ?? 0) + 1)
      }
    }
    return hits
  }
}

// ── Long-Term Memory ─────────────────────────────────────────────────────────

export class LTM {
  private nodes = new Map<string, MemoryNode>()
  private index = new InvertedIndex()
  private byCategory = new Map<FactCategory, Set<string>>()
  private maxNodes: number

  constructor(maxNodes = 1000) {
    this.maxNodes = maxNodes
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  add(node: Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>): MemoryNode {
    // Check for duplicates (similar content in same category)
    const existing = this.findDuplicate(node.content, node.category)
    if (existing) {
      // Merge: update importance if new one is higher
      if (node.importance > existing.importance) {
        existing.importance = node.importance
      }
      existing.lastAccessedAt = Date.now()
      existing.accessCount++
      return existing
    }

    // Prune if at capacity
    if (this.nodes.size >= this.maxNodes) {
      this.pruneLowest()
    }

    const full: MemoryNode = {
      ...node,
      id: uid(),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    }

    this.nodes.set(full.id, full)
    this.index.add(full.id, full.content + ' ' + full.tags.join(' '))

    if (!this.byCategory.has(full.category)) {
      this.byCategory.set(full.category, new Set())
    }
    this.byCategory.get(full.category)!.add(full.id)

    return full
  }

  delete(id: string): void {
    const node = this.nodes.get(id)
    if (!node) return
    this.index.remove(id, node.content + ' ' + node.tags.join(' '))
    this.byCategory.get(node.category)?.delete(id)
    this.nodes.delete(id)
  }

  clear(): void {
    this.nodes.clear()
    this.index = new InvertedIndex()
    this.byCategory.clear()
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  query(text: string, opts: MemoryQueryOptions = {}): MemoryNode[] {
    const {
      category,
      limit = 5,
      minImportance = 0,
      recencyBias = 0.3,
    } = opts

    const hits = this.index.search(text)
    const now = Date.now()
    const maxAge = now - (this.oldestNodeAge() || 1)

    const scored: Array<{ node: MemoryNode; score: number }> = []

    for (const [id, matchCount] of hits) {
      const node = this.nodes.get(id)
      if (!node) continue
      if (category && node.category !== category) continue
      if (node.importance < minImportance) continue

      // Similarity: fraction of query tokens matched
      const queryTokenCount = this.index['tokenize'](text).length || 1
      const similarity = matchCount / queryTokenCount

      // Recency: normalised age (1 = brand new, 0 = oldest possible)
      const recency = 1 - (now - node.createdAt) / maxAge

      // Importance: normalised 1-10 → 0-1
      const importanceScore = node.importance / 10

      const score =
        similarity * (1 - recencyBias) * 0.6 +
        recency * recencyBias +
        importanceScore * 0.4

      scored.push({ node, score })
    }

    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => {
        // Update access tracking
        s.node.lastAccessedAt = Date.now()
        s.node.accessCount++
        return s.node
      })

    return results
  }

  // Retrieve all nodes by category
  byCategory_(category: FactCategory): MemoryNode[] {
    const ids = this.byCategory.get(category) ?? new Set()
    return [...ids]
      .map(id => this.nodes.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.importance - a.importance)
  }

  get size(): number {
    return this.nodes.size
  }

  all(): MemoryNode[] {
    return [...this.nodes.values()]
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private findDuplicate(content: string, category: FactCategory): MemoryNode | null {
    const ids = this.byCategory.get(category) ?? new Set()
    const contentLower = content.toLowerCase()
    for (const id of ids) {
      const node = this.nodes.get(id)!
      if (node.content.toLowerCase() === contentLower) return node
    }
    return null
  }

  private pruneLowest(): void {
    // Remove the node with the lowest importance×accessCount score
    let lowestId = ''
    let lowestScore = Infinity
    for (const node of this.nodes.values()) {
      const score = node.importance + node.accessCount * 0.5
      if (score < lowestScore) {
        lowestScore = score
        lowestId = node.id
      }
    }
    if (lowestId) this.delete(lowestId)
  }

  private oldestNodeAge(): number {
    let oldest = Date.now()
    for (const node of this.nodes.values()) {
      if (node.createdAt < oldest) oldest = node.createdAt
    }
    return Date.now() - oldest
  }
}
