# API Reference

This page contains a high-density reference for the core configuration objects in **Marie**.

## `Agent` Configuration

```typescript
interface AgentConfig {
  model: string;             // Model name (e.g. "gpt-4o")
  apiKey: string;            // Provider API Key
  baseUrl?: string;          // API Endpoint (default: OpenAI)
  systemPrompt?: string;     // Global behavioral instructions
  temperature?: number;      // 0.0 to 2.0 (default: 0.7)
  safeMode?: boolean;        // Prohibit unsafe tools (default: true)
  timeoutMs?: number;        // Max wall-clock time per request (default: 60s)
  budget?: Budget;           // Hard cost/token limits
  middleware?: Middleware[]; // Pipeline processors
  cache?: Cache;             // Response caching engine
}
```

## `Memory` Configuration

```typescript
interface MemoryConfig {
  recentTurns?: number;       // Raw turns kept in STM (default: 8)
  maxStmSummaries?: number;   // Max summary blocks in STM (default: 3)
  maxLtmNodes?: number;       // Cap on long-term facts (default: 1000)
  persist?: MemoryPersist;    // Persistence adapter (SQLite, JSON)
  categories?: string[];      // Only extract these fact types
}
```

## `Budget` Configuration

```typescript
interface Budget {
  maxTokens?: number;      // Stop if total tokens in a run > N
  maxCostUsd?: number;     // Stop if total cost in a run > $N
  maxSteps?: number;       // Stop if tool loop > N iterations
  warnAt?: number;         // Emits event when usage > % limit (default: 0.8)
}
```

## `Middleware` Interface

```typescript
interface Middleware {
  name: string;
  before?(ctx: MiddlewareContext): void | Promise<void>;
  after?(ctx: MiddlewareContext): void | Promise<void>;
  onError?(ctx: MiddlewareContext, err: Error): void | Promise<void>;
}
```

### `MiddlewareContext`

The context object shared across the pipeline for a single request:
- `messages`: The current conversation stack.
- `model`: Model being used for this specific call.
- `step`: Current iteration number (1-indexed).
- `usage`: Token usage for the *current* step.
- `totalUsage`: Cumulative token usage for the entire request.
- `costUsd`: Cost for the *current* step in USD.
- `metadata`: A persistent key-value store to pass data between middleware.
