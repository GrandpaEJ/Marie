// Intelligent model router — routes each query to the cheapest viable model.
// 
// Strategy (zero extra LLM calls by default):
//   1. Rule-based complexity classifier (fast, free)
//   2. Picks cheapest model in the matching tier
//   3. Falls back to configured default model
//
// Override: pass `routerModel` to use a cheap LLM for harder classification.

import { MODEL_COSTS, type ModelMeta } from './models.ts'

export type Tier = ModelMeta['tier']

export interface RouterConfig {
  // Model to use for each tier. If omitted, autoselected from registry.
  nano?: string
  fast?: string
  frontier?: string
  // Default tier when no rule matches
  defaultTier?: Tier
}

// ── Rule-based complexity classifier ──────────────────────────────────────

interface ComplexityRule {
  tier: Tier
  test(message: string, hasTools: boolean): boolean
}

const RULES: ComplexityRule[] = [
  // Nano: short, purely factual, no tools needed
  {
    tier: 'nano',
    test(msg, hasTools) {
      if (hasTools) return false
      const words = msg.trim().split(/\s+/).length
      const nanoPatterns = [
        /^(what is|what's|who is|who's|when did|when is|how many|how much)\b/i,
        /\b(translate|convert|format|summarize in one sentence)\b/i,
        /^[\d\s+\-*/()^.]+$/, // pure math
      ]
      return words <= 20 && nanoPatterns.some(p => p.test(msg))
    },
  },
  // Frontier: complex reasoning, long, multi-step, code generation
  {
    tier: 'frontier',
    test(msg) {
      const words = msg.trim().split(/\s+/).length
      const frontierPatterns = [
        /\b(architect|design|implement|refactor|debug|analyze|reason|strategize)\b/i,
        /\b(write (a |the )?(full|complete|production|complex))\b/i,
        /\b(compare and contrast|pros and cons|tradeoffs)\b/i,
        /\b(step[- ]by[- ]step|detailed plan|comprehensive)\b/i,
      ]
      return words > 80 || frontierPatterns.some(p => p.test(msg))
    },
  },
  // Fast: everything else
  {
    tier: 'fast',
    test() { return true },
  },
]

function classifyTier(message: string, hasTools: boolean): Tier {
  for (const rule of RULES) {
    if (rule.test(message, hasTools)) return rule.tier
  }
  return 'fast'
}

// ── Router ─────────────────────────────────────────────────────────────────

export class ModelRouter {
  private tierMap: Record<Tier, string | undefined>
  private defaultTier: Tier

  constructor(cfg: RouterConfig = {}) {
    this.defaultTier = cfg.defaultTier ?? 'fast'
    this.tierMap = {
      nano: cfg.nano,
      fast: cfg.fast,
      frontier: cfg.frontier,
    }
  }

  // Auto-pick cheapest model for a given tier from the registry
  private cheapestInTier(tier: Tier): string | undefined {
    const candidates = Object.entries(MODEL_COSTS)
      .filter(([, meta]) => meta.tier === tier)
      .sort(([, a], [, b]) => a.input - b.input)
    return candidates[0]?.[0]
  }

  // Route a message to the best model name.
  // `fallback` is the agent's configured default model (always a valid fallback).
  route(message: string, hasTools: boolean, fallback: string): string {
    const tier = classifyTier(message, hasTools)
    const model =
      this.tierMap[tier] ??
      this.tierMap[this.defaultTier] ??
      this.cheapestInTier(tier) ??
      fallback
    return model
  }

  // Expose tier classification for observability
  classify(message: string, hasTools: boolean): Tier {
    return classifyTier(message, hasTools)
  }
}
