// Semantic memory using vector embeddings
// Supports semantic search, memory stores, and auto-injection

import type { Message } from '../types.ts'

export interface EmbeddingConfig {
  provider: 'openai' | 'local' | 'none'
  model?: string
  apiKey?: string
  baseUrl?: string
}

export interface MemoryEntry {
  id: string
  content: string
  embedding: number[]
  timestamp: number
  importance: number
  tags: string[]
  metadata: Record<string, unknown>
}

export interface SemanticSearchOptions {
  topK?: number
  threshold?: number
  filter?: (entry: MemoryEntry) => boolean
}

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'

// Generate embedding using OpenAI API
async function generateEmbeddingOpenAI(
  text: string,
  config: EmbeddingConfig
): Promise<number[]> {
  const url = `${config.baseUrl || 'https://api.openai.com/v1'}/embeddings`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: text.slice(0, 8000), // Truncate long text
      model: config.model || DEFAULT_EMBEDDING_MODEL,
    }),
  })

  if (!res.ok) {
    throw new Error(`Embedding API error: ${res.status}`)
  }

  const data = await res.json() as any
  return data.data[0].embedding
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
}

export class SemanticMemory {
  private entries: Map<string, MemoryEntry> = new Map()
  private embeddingConfig: EmbeddingConfig
  private generateEmbedding: (text: string) => Promise<number[]>

  constructor(config: EmbeddingConfig = { provider: 'none' }) {
    this.embeddingConfig = config

    // Set up embedding function based on provider
    if (config.provider === 'openai') {
      this.generateEmbedding = (text: string) => generateEmbeddingOpenAI(text, config)
    } else {
      // Fallback: simple hash-based pseudo-embedding
      this.generateEmbedding = this.simpleEmbedding.bind(this)
    }
  }

  // Simple pseudo-embedding for when no API is available
  private async simpleEmbedding(text: string): Promise<number[]> {
    const hash = text.split('').reduce((acc, char, i) => {
      return acc + char.charCodeAt(0) * (i + 1)
    }, 0)
    // Generate a deterministic pseudo-random vector
    const dim = 4 // Small dimension for demo
    return Array.from({ length: dim }, (_, i) => {
      const val = Math.sin(hash * (i + 1) * 0.1)
      return (val - 0.5) * 2 // Normalize to [-1, 1]
    })
  }

  // Add a memory entry
  async add(
    content: string,
    options: {
      importance?: number
      tags?: string[]
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<string> {
    const id = crypto.randomUUID()
    const embedding = await this.generateEmbedding(content)

    this.entries.set(id, {
      id,
      content,
      embedding,
      timestamp: Date.now(),
      importance: options.importance ?? 0.5,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
    })

    return id
  }

  // Add from message
  async addMessage(msg: Message, options: { importance?: number; tags?: string[] } = {}): Promise<string> {
    const content = msg.content as string
    if (!content) return ''

    return this.add(content, {
      ...options,
      metadata: {
        role: msg.role,
        ...options.metadata,
      },
    })
  }

  // Semantic search
  async search(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<MemoryEntry[]> {
    const topK = options.topK ?? 5
    const threshold = options.threshold ?? 0.3

    const queryEmbedding = await this.generateEmbedding(query)

    const scored = Array.from(this.entries.values())
      .filter(entry => !options.filter || options.filter(entry))
      .map(entry => ({
        entry,
        score: cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return scored.map(r => r.entry)
  }

  // Get relevant memories for injection into context
  async getRelevant(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<Message[]> {
    const entries = await this.search(query, options)

    return entries.map(entry => ({
      role: 'system' as const,
      content: `[Memory] ${entry.content}`,
    }))
  }

  // Delete by ID
  delete(id: string): boolean {
    return this.entries.delete(id)
  }

  // Clear all
  clear(): void {
    this.entries.clear()
  }

  // Stats
  get size(): number {
    return this.entries.size
  }

  // Export/Import for persistence
  export(): MemoryEntry[] {
    return Array.from(this.entries.values())
  }

  import(entries: MemoryEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.id, entry)
    }
  }
}