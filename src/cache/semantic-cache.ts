// Smart caching with semantic similarity
// Caches responses and retrieves by semantic similarity when exact match fails

import type { Cache } from '../types.ts'
import { SemanticMemory } from '../memory/semantic.ts'

export interface SemanticCacheOptions {
  similarityThreshold?: number
  maxCacheSize?: number
  ttlMs?: number
  embeddingConfig?: { provider: 'openai'; apiKey: string }
}

export class SemanticCache implements Cache {
  private cache: Map<string, { value: string; timestamp: number; embedding: number[] }> = new Map()
  private semanticMemory: SemanticMemory
  private threshold: number
  private maxSize: number
  private ttlMs: number

  constructor(opts: SemanticCacheOptions = {}) {
    this.threshold = opts.similarityThreshold ?? 0.85
    this.maxSize = opts.maxCacheSize ?? 500
    this.ttlMs = opts.ttlMs ?? 3600000 // 1 hour default

    // Use simple embeddings if no API key provided
    this.semanticMemory = new SemanticMemory(opts.embeddingConfig || { provider: 'none' })
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
  }

  private async getEmbedding(key: string): Promise<number[]> {
    const entries = await this.semanticMemory.search(key, { topK: 1, threshold: 0 })
    if (entries.length > 0 && entries[0].content === key) {
      return entries[0].embedding
    }
    // Generate new embedding
    return this.semanticMemory['generateEmbedding'](key)
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key)
    if (!entry) {
      // Try semantic similarity search
      const embedding = await this.getEmbedding(key)
      let bestMatch: string | null = null
      let bestScore = 0

      for (const [cacheKey, cached] of this.cache) {
        if (Date.now() - cached.timestamp > this.ttlMs) {
          this.cache.delete(cacheKey)
          continue
        }

        const score = this.cosineSimilarity(embedding, cached.embedding)
        if (score > bestScore && score >= this.threshold) {
          bestScore = score
          bestMatch = cacheKey
        }
      }

      if (bestMatch) {
        console.log(`[semantic-cache] Hit with similarity ${bestScore.toFixed(2)}`)
        return this.cache.get(bestMatch)!.value
      }

      return null
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  async set(key: string, value: string): Promise<void> {
    // Evict oldest if full
    if (this.cache.size >= this.maxSize) {
      let oldest: string | null = null
      let oldestTime = Infinity

      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp
          oldest = k
        }
      }

      if (oldest) this.cache.delete(oldest)
    }

    const embedding = await this.getEmbedding(key)
    this.cache.set(key, { value, timestamp: Date.now(), embedding })
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}