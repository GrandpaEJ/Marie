// Public surface of the library — everything a consumer needs.
// v1: expanded exports for middleware, cache, routing, memory, orchestration.

// ── Core ──────────────────────────────────────────────────────────────────
export { Agent } from './agent.ts'
export { ToolRegistry } from './tools.ts'
export { LLMClient } from './client.ts'

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  Tool,
  Message,
  AgentConfig,
  ChatOptions,
  Middleware,
  MiddlewareContext,
  Budget,
  Cache,
  CostMetrics,
  TokenUsage,
  AgentEvent,
  EventHandler,
} from './types.ts'

// ── Errors ────────────────────────────────────────────────────────────────
export {
  SilviError,
  LLMError,
  LLMTimeoutError,
  BudgetExceededError,
  ToolTimeoutError,
  ToolValidationError,
  SafeModeError,
} from './core/errors.ts'

// ── Middleware ─────────────────────────────────────────────────────────────
export { createLogger } from './middleware/logger.ts'
export { createCostTracker } from './middleware/cost-tracker.ts'

// ── Cache ─────────────────────────────────────────────────────────────────
export { MemoryCache } from './cache/memory-cache.ts'

// ── Routing ───────────────────────────────────────────────────────────────
export { ModelRouter } from './routing/router.ts'
export { MODEL_COSTS, estimateCost, registerModel, getModel } from './routing/models.ts'

// ── Memory ────────────────────────────────────────────────────────────────
export { SlidingWindowMemory } from './memory/sliding-window.ts'
export { Memory } from './memory/memory.ts'
export { createMemoryMiddleware } from './memory/middleware.ts'
export { JSONAdapter } from './memory/adapters/json.ts'
export { SQLiteAdapter } from './memory/adapters/sqlite.ts'
export type { MemoryConfig, MemoryNode, FactCategory, MemoryPersist, MemorySnapshot } from './memory/types.ts'

// ── Orchestration ─────────────────────────────────────────────────────────
export { Supervisor } from './orchestration/supervisor.ts'
export { Pipeline } from './orchestration/pipeline.ts'
export { Parallel } from './orchestration/parallel.ts'
