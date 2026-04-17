// Model registry — cost metadata for popular models.
// Prices are in USD per 1M tokens. Update as providers change pricing.
// Used by cost-tracker.ts for accurate cost estimation.

export interface ModelMeta {
  input: number    // USD per 1M input tokens
  output: number   // USD per 1M output tokens
  context: number  // max context window in tokens
  tier: 'nano' | 'fast' | 'frontier'
  provider?: string
}

// ── Cost catalogue ─────────────────────────────────────────────────────────
// Sources: official pricing pages as of April 2026
export const MODEL_COSTS: Record<string, ModelMeta> = {
  // ── OpenAI ──
  'gpt-4.1':            { input: 2.00,  output: 8.00,   context: 1_000_000, tier: 'frontier', provider: 'openai' },
  'gpt-4.1-mini':       { input: 0.40,  output: 1.60,   context: 1_000_000, tier: 'fast',     provider: 'openai' },
  'gpt-4.1-nano':       { input: 0.10,  output: 0.40,   context: 1_000_000, tier: 'nano',     provider: 'openai' },
  'gpt-4o':             { input: 2.50,  output: 10.00,  context: 128_000,   tier: 'frontier', provider: 'openai' },
  'gpt-4o-mini':        { input: 0.15,  output: 0.60,   context: 128_000,   tier: 'fast',     provider: 'openai' },
  'o1':                 { input: 15.00, output: 60.00,  context: 200_000,   tier: 'frontier', provider: 'openai' },
  'o1-mini':            { input: 3.00,  output: 12.00,  context: 128_000,   tier: 'fast',     provider: 'openai' },
  'o3-mini':            { input: 1.10,  output: 4.40,   context: 200_000,   tier: 'fast',     provider: 'openai' },

  // ── Anthropic ──
  'claude-opus-4-5':              { input: 15.00, output: 75.00,  context: 200_000, tier: 'frontier', provider: 'anthropic' },
  'claude-sonnet-4-5':            { input: 3.00,  output: 15.00,  context: 200_000, tier: 'frontier', provider: 'anthropic' },
  'claude-haiku-3-5':             { input: 0.80,  output: 4.00,   context: 200_000, tier: 'fast',     provider: 'anthropic' },

  // ── OpenRouter aliases ──
  'openai/gpt-4o':                { input: 2.50,  output: 10.00,  context: 128_000, tier: 'frontier', provider: 'openrouter' },
  'openai/gpt-4o-mini':           { input: 0.15,  output: 0.60,   context: 128_000, tier: 'fast',     provider: 'openrouter' },
  'anthropic/claude-haiku-3-5':   { input: 0.80,  output: 4.00,   context: 200_000, tier: 'fast',     provider: 'openrouter' },
  'meta-llama/llama-3.3-70b-instruct': { input: 0.12, output: 0.30, context: 128_000, tier: 'fast', provider: 'openrouter' },

  // ── Groq ──
  'llama3-8b-8192':     { input: 0.05,  output: 0.08,   context: 8_192,   tier: 'nano',     provider: 'groq' },
  'llama3-70b-8192':    { input: 0.59,  output: 0.79,   context: 8_192,   tier: 'fast',     provider: 'groq' },
  'mixtral-8x7b-32768': { input: 0.24,  output: 0.24,   context: 32_768,  tier: 'fast',     provider: 'groq' },
  'gemma2-9b-it':       { input: 0.20,  output: 0.20,   context: 8_192,   tier: 'nano',     provider: 'groq' },

  // ── Ollama / local — zero cost ──
  'llama3.2:3b':        { input: 0, output: 0, context: 128_000, tier: 'nano',    provider: 'ollama' },
  'llama3.1:8b':        { input: 0, output: 0, context: 128_000, tier: 'fast',    provider: 'ollama' },
  'mistral':            { input: 0, output: 0, context: 32_768,  tier: 'fast',    provider: 'ollama' },
  'qwen2.5:7b':         { input: 0, output: 0, context: 128_000, tier: 'fast',    provider: 'ollama' },
}

// Register extra models at runtime (e.g. from a config file)
export function registerModel(name: string, meta: ModelMeta): void {
  MODEL_COSTS[name] = meta
}

// Cost estimate in USD — returns 0 for unknown models (safe default)
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const meta = MODEL_COSTS[model]
  if (!meta) return 0
  return (promptTokens * meta.input + completionTokens * meta.output) / 1_000_000
}

// Get metadata for a model, with a safe fallback
export function getModel(name: string): ModelMeta | undefined {
  return MODEL_COSTS[name]
}

// Returns the tier of a model (for routing decisions)
export function getModelTier(name: string): ModelMeta['tier'] {
  return MODEL_COSTS[name]?.tier ?? 'frontier'
}
