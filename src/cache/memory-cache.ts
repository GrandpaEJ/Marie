// In-memory LRU cache — zero dependencies.
// Evicts the least-recently-used entry when capacity is exceeded.
// Safe to use in a single-process Bun server.

import type { Cache } from '../types.ts'

interface Entry {
  value: string
  expiresAt: number | null   // null = no expiry
}

export class MemoryCache implements Cache {
  private map = new Map<string, Entry>()
  private readonly maxEntries: number

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries
  }

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.map.delete(key)
      return null
    }
    // LRU: move to end (Map preserves insertion order)
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    // Evict LRU entry if at capacity
    if (this.map.size >= this.maxEntries && !this.map.has(key)) {
      const lruKey = this.map.keys().next().value
      if (lruKey !== undefined) this.map.delete(lruKey)
    }
    this.map.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    })
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key)
  }

  async clear(): Promise<void> {
    this.map.clear()
  }

  size(): number {
    return this.map.size
  }
}
