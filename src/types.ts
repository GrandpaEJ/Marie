// Core shared types — keep everything here so imports stay simple.
// v1: added Middleware, Budget, AgentEvent, tool enhancements.

// ── Primitives ─────────────────────────────────────────────────────────────

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_call_id?: string        // present on role=tool messages
  tool_calls?: ToolCallRef[]  // present on assistant messages that invoke tools
}

export interface ToolCallRef {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

// ── Tool ──────────────────────────────────────────────────────────────────

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>    // JSON Schema object
  safe: boolean                          // true = allowed even when safeMode=true
  run(params: Record<string, unknown>): Promise<string>
  timeoutMs?: number                     // per-tool execution timeout (default: none)
  retries?: number                       // auto-retry failed run() calls (default: 0)
  validate?(params: Record<string, unknown>): string | null  // return error string or null
}

// ── Token & Cost Tracking ─────────────────────────────────────────────────

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface CostMetrics {
  tokenUsage: TokenUsage
  costUsd: number
  steps: number
  cachedSteps: number
  durationMs: number
}

// ── Budget ─────────────────────────────────────────────────────────────────

export interface Budget {
  maxTokens?: number        // hard cap on total tokens per run()
  maxCostUsd?: number       // hard cap on USD cost per run()
  maxDurationMs?: number    // wall-clock time limit per run()
  maxSteps?: number         // max tool-call iterations (was AgentConfig.maxSteps)
  warnAt?: number           // fraction of budget to emit warning (default 0.8 = 80%)
}

// ── Middleware ─────────────────────────────────────────────────────────────

export interface MiddlewareContext {
  messages: Message[]
  model: string
  step: number
  usage: TokenUsage
  costUsd: number
  startedAt: number                       // epoch ms when the run() started
  cached: boolean                         // was this step served from cache?
  totalUsage: TokenUsage                  // cumulative tokens for the whole run()
  totalCostUsd: number                    // cumulative cost for the whole run()
  metadata: Record<string, unknown>       // carry arbitrary data between middleware
}

export interface Middleware {
  name: string
  before?(ctx: MiddlewareContext): Promise<void> | void
  after?(ctx: MiddlewareContext): Promise<void> | void
  onError?(ctx: MiddlewareContext, err: Error): Promise<void> | void
}

// ── Events ─────────────────────────────────────────────────────────────────

export type AgentEvent =
  | 'llm:start'
  | 'llm:end'
  | 'llm:error'
  | 'tool:start'
  | 'tool:end'
  | 'tool:error'
  | 'budget:warning'
  | 'budget:exceeded'
  | 'step:start'
  | 'step:end'
  | 'cache:hit'
  | 'cache:miss'

export type EventHandler = (event: AgentEvent, data: unknown) => void

// ── Cache ──────────────────────────────────────────────────────────────────

export interface Cache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlMs?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  size(): number
}

// ── Agent Config ───────────────────────────────────────────────────────────

export interface AgentConfig {
  model: string
  apiKey: string
  baseUrl?: string            // default: https://api.openai.com/v1
  systemPrompt?: string
  safeMode?: boolean          // default: true — only safe:true tools can run
  maxSteps?: number           // kept for backward compat — also settable via budget.maxSteps
  temperature?: number
  timeoutMs?: number          // per-LLM-request timeout (default: 60_000ms)
  budget?: Budget             // hard limits on tokens / cost / time / steps
  middleware?: Middleware[]   // processed in order before/after each LLM call
  cache?: Cache               // optional response cache
  onEvent?: EventHandler      // subscribe to all agent events
}

// ── Chat Options ───────────────────────────────────────────────────────────

export interface ChatOptions {
  history?: Message[]
  model?: string              // override model for this specific call
  metadata?: Record<string, unknown> // metadata passed into the middleware for this run
}

// ── Internal ───────────────────────────────────────────────────────────────

// Accumulator for streaming tool-call fragments (SSE arrives in pieces)
export interface ToolCallAccum {
  id: string
  name: string
  args: string
}
