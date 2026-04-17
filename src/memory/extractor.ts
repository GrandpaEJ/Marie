// Fact Extractor — turns raw conversation text into structured MemoryNodes.
// Default: heuristic patterns (zero cost, instant).
// Optional: LLM-powered extraction for richer understanding.

import type { FactCategory, MemoryNode } from './types.ts'

type RawExtract = Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>

// ── Heuristic Patterns ──────────────────────────────────────────────────────
// Simple regex rules that cover the most common fact-disclosure patterns.

interface HeuristicRule {
  pattern: RegExp
  category: FactCategory
  importance: number
  extract(match: RegExpMatchArray): string | null
  tags(match: RegExpMatchArray): string[]
}

const RULES: HeuristicRule[] = [
  // Names
  {
    pattern: /my name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
    category: 'name',
    importance: 9,
    extract: m => `User's name is ${m[1]}`,
    tags: m => ['name', 'user', m[1].toLowerCase()],
  },
  {
    pattern: /(?:i am|i'm) called ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
    category: 'name',
    importance: 9,
    extract: m => `User is called ${m[1]}`,
    tags: m => ['name', 'user', m[1].toLowerCase()],
  },
  {
    pattern: /call me ([A-Z][a-z]+)/i,
    category: 'name',
    importance: 8,
    extract: m => `User prefers to be called ${m[1]}`,
    tags: m => ['name', 'user', m[1].toLowerCase()],
  },
  // Relationships
  {
    pattern: /my (brother|sister|mother|father|mom|dad|wife|husband|son|daughter|friend) (?:is |'?s? called |'?s? named )?([A-Z][a-z]+)/i,
    category: 'name',
    importance: 7,
    extract: m => `User's ${m[1]} is ${m[2]}`,
    tags: m => ['family', m[1].toLowerCase(), m[2].toLowerCase()],
  },
  // Location
  {
    pattern: /i (?:live|stay|am) (?:in|at|from) ([\w\s,]+?)(?:\.|,|$)/i,
    category: 'location',
    importance: 8,
    extract: m => `User lives in ${m[1].trim()}`,
    tags: m => ['location', ...m[1].trim().toLowerCase().split(/\s+/)],
  },
  {
    pattern: /(?:i'm|i am) from ([\w\s]+?)(?:\.|,|$)/i,
    category: 'location',
    importance: 7,
    extract: m => `User is from ${m[1].trim()}`,
    tags: m => ['location', ...m[1].trim().toLowerCase().split(/\s+/)],
  },
  // Profession / niche
  {
    pattern: /i (?:am|'m) a(?:n)? ([\w\s]+? (?:developer|engineer|designer|manager|doctor|teacher|student|founder|builder))/i,
    category: 'niche',
    importance: 8,
    extract: m => `User is a ${m[1].trim()}`,
    tags: m => ['profession', ...m[1].trim().toLowerCase().split(/\s+/)],
  },
  {
    pattern: /i work (?:on|at|for|with) ([\w\s]+?)(?:\.|,|$)/i,
    category: 'niche',
    importance: 7,
    extract: m => `User works on/at ${m[1].trim()}`,
    tags: m => ['work', ...m[1].trim().toLowerCase().split(/\s+/)],
  },
  // Preferences
  {
    pattern: /i (?:love|really like|prefer|enjoy|always use) ([\w\s]+?)(?:\.|,|$)/i,
    category: 'preference',
    importance: 6,
    extract: m => `User loves/prefers ${m[1].trim()}`,
    tags: m => ['preference', 'like', ...m[1].trim().toLowerCase().split(/\s+/)],
  },
  {
    pattern: /i (?:hate|dislike|don't like|never use) ([\w\s]+?)(?:\.|,|$)/i,
    category: 'preference',
    importance: 6,
    extract: m => `User dislikes ${m[1].trim()}`,
    tags: m => ['preference', 'dislike', ...m[1].trim().toLowerCase().split(/\s+/)],
  },
  // General facts
  {
    pattern: /(?:i have|i own|i run|i built|i created|i made) (?:a |an )?([\w\s]+?)(?:\.|,|$)/i,
    category: 'fact',
    importance: 7,
    extract: m => `User has/runs ${m[1].trim()}`,
    tags: m => ['possession', ...m[1].trim().toLowerCase().split(/\s+/)],
  },
]

// ── Heuristic Extractor ─────────────────────────────────────────────────────

export function extractHeuristic(text: string): RawExtract[] {
  const results: RawExtract[] = []

  for (const rule of RULES) {
    const match = text.match(rule.pattern)
    if (!match) continue

    const content = rule.extract(match)
    if (!content) continue

    results.push({
      content,
      category: rule.category,
      importance: rule.importance,
      tags: rule.tags(match),
      source: 'heuristic',
    })
  }

  return results
}

// ── Extractor Factory ───────────────────────────────────────────────────────

export type ExtractFn = (text: string) => Promise<RawExtract[]>

// Creates an extractor that first runs heuristics, then optionally calls an
// LLM-based extractor for anything the heuristics missed.
export function createExtractor(
  llmExtract?: (text: string) => Promise<RawExtract[]>,
): ExtractFn {
  return async (text: string): Promise<RawExtract[]> => {
    const heuristics = extractHeuristic(text)

    if (!llmExtract) return heuristics

    try {
      const llmResults = await llmExtract(text)
      // Merge: heuristics first (higher confidence), then LLM additions
      const seen = new Set(heuristics.map(r => r.content.toLowerCase()))
      const combined = [...heuristics]
      for (const r of llmResults) {
        if (!seen.has(r.content.toLowerCase())) {
          r.source = 'llm'
          combined.push(r)
        }
      }
      return combined
    } catch {
      return heuristics
    }
  }
}
