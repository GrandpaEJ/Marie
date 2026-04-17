# Silvi v1 — Architecture & Design Decisions

## Goal

A fast, embeddable agent library that:
- Works with **any OpenAI-compatible API** (OpenRouter, Groq, local Ollama, etc.)
- Integrates natively into JS/TS bots (Telegram, Discord, FB Messenger, etc.)
- Is usable from **Python or any language** via an HTTP bridge
- Enforces **safe mode** so public-facing bots can't accidentally run destructive tools
- Keeps API costs **low and predictable** via routing, caching, and budget enforcement
- Scales from a **single bot** to **multi-agent teams** using the same core

---

## Language: TypeScript (Bun runtime)

**Why not Go?** Go would produce a faster binary, but the primary use-case is a *library* that JS/TS bots import directly. Shipping a Go binary as a library requires CGo bindings (complex, breaks cross-compilation) or gRPC/HTTP (extra process + latency). The existing `server.ts` HTTP bridge already speaks clean REST — a Go backend would be a drop-in replacement if needed later.

**Why Bun over Node?**
- ~3× faster startup, faster `fetch`, ships TypeScript natively (no build step)
- Built-in `Bun.serve`, `Bun.spawn`, `Bun.file` cover 100% of runtime needs
- Zero runtime deps — nothing to install beyond `bun` itself

---

## File Layout

```
src/
  types.ts               — ALL shared interfaces (single source of truth)
  client.ts              — streaming OpenAI-compat client (fetch + SSE + retry)
  tools.ts               — ToolRegistry: register, validate, run, export to OpenAI format
  agent.ts               — Agent: middleware pipeline, event emitter, budget, cache
  server.ts              — HTTP bridge: /chat /stream /health /metrics

  core/
    errors.ts            — typed error classes (BudgetExceededError, ToolTimeoutError, …)

  middleware/
    logger.ts            — structured JSON logging middleware
    cost-tracker.ts      — token counting + USD cost tracking + budget enforcement

  routing/
    models.ts            — model registry: cost/token/tier metadata for 20+ models
    router.ts            — rule-based model router (tier classification, no extra LLM cost)

  cache/
    memory-cache.ts      — LRU cache with TTL (zero deps, Map-based)

  memory/
    sliding-window.ts    — sliding window memory + optional auto-summarization

  orchestration/
    supervisor.ts        — supervisor-worker pattern (boss delegates to specialists)
    pipeline.ts          — sequential pipeline (output of one → input of next)
    parallel.ts          — split-and-merge parallel execution

tools/
  web.ts                 — web_fetch  (safe=true, 12k char cap)
  shell.ts               — shell      (safe=false, timeout wrapper)
  file.ts                — file_read  (safe=true), file_write (safe=false)
  index.ts               — re-exports all built-ins

integrations/
  telegram.ts            — Telegram bot (long-polling, streaming edits, per-user memory)

examples/
  basic.ts               — minimal usage (streaming, safe mode, provider swap)
  cost-aware.ts          — model routing + budget + cache demo
  multi-agent.ts         — supervisor, pipeline, parallel demos
  telegram-bot.ts        — production Telegram bot in ~40 lines
  ollama-test.ts         — local Ollama provider demo
  ollama-tool-test.ts    — Ollama with tool calling
```

Each file has one job. `types.ts` is the single source of truth — nothing needs to import across multiple files to compose a type.

---

## Middleware Pipeline

Every LLM call in the agent loop passes through a middleware stack:

```
agent.run(message)
  │
  ▼
[before() for each middleware, in order]
  ├── cost-tracker: check budget, increment step counter
  └── logger: log llm:start
  │
  ▼
[stream LLM response]
  │
  ▼
[after() for each middleware, in order]
  ├── cost-tracker: accumulate tokens, check cost budget
  └── logger: log llm:end with latency + cost
```

**Middleware receives a shared `MiddlewareContext`** — it can write into `ctx.metadata` to pass data to subsequent middleware. Built-in middleware (`cost-tracker`, `logger`) are always the first in the stack.

Custom middleware example:
```typescript
agent.use({
  name: 'my-filter',
  before(ctx) {
    if (ctx.step > 5) throw new Error('Too many steps')
  },
  after(ctx) {
    console.log(`Step ${ctx.step} cost: $${ctx.costUsd}`)
  },
})
```

---

## Safe Mode

**Design:** every `Tool` carries a `safe: boolean` flag.
When `Agent.cfg.safeMode === true`, the agent refuses to call any tool where `safe=false`, throwing a `SafeModeError` that the LLM receives as the tool result.

**Built-in posture:**

| Tool        | safe  | Reason                             |
|-------------|-------|------------------------------------|
| web_fetch   | true  | read-only, no side effects         |
| file_read   | true  | read-only                          |
| shell       | false | arbitrary execution — opt-in only  |
| file_write  | false | can clobber files — opt-in only    |

---

## Agent Loop

```
user message
  │
  ▼
[cache check — hash(model + messages)]
  │ hit → return cached response (free, instant)
  │ miss ↓
  │
  ▼ (repeat up to budget.maxSteps)
[before middleware]
  │
  ▼
[stream LLM completion]
  │
  ├── text delta → yield to caller (streaming UX)
  └── tool_calls → accumulate fragments
        │
        ▼
[execute each tool: validate → safeMode check → timeout → retry]
        │
        ▼
[push tool results → messages]
        │
        ▼
[after middleware: track tokens + cost, check budget]
        │
        ▼ (loop back, or break if finish_reason ≠ tool_calls)
```

---

## Cost Layer

Three mechanisms combine to minimize API spend:

### 1. Model Routing (saves 70-90% on simple queries)
```typescript
const router = new ModelRouter({ nano: 'gpt-4.1-nano', fast: 'gpt-4o-mini', frontier: 'gpt-4o' })
const model = router.route(message, hasTools, defaultModel)
// "What is 5+5?" → nano ($0.10/Mtok) not frontier ($2.50/Mtok)
```

### 2. Response Caching (saves 100% on repeated queries)
```typescript
const agent = new Agent({ cache: new MemoryCache(500), ... })
// Second identical query → instant, $0 cost
```

### 3. Budget Enforcement (prevents runaway spend)
```typescript
const agent = new Agent({ budget: { maxCostUsd: 0.05, maxTokens: 10_000 }, ... })
// Throws BudgetExceededError before limit is hit — never overspends
```

---

## Multi-Agent Patterns

Three ready-to-use orchestration patterns, each a separate importable module:

| Pattern | Use case | File |
|---------|----------|------|
| **Supervisor** | Complex tasks needing specialist delegation | `orchestration/supervisor.ts` |
| **Pipeline** | Sequential step-by-step workflows | `orchestration/pipeline.ts` |
| **Parallel** | Independent sub-tasks → merged result | `orchestration/parallel.ts` |

**Rule:** only add multi-agent complexity when a single well-prompted agent is insufficient. Coordination overhead is real (+39-70% latency on simple tasks).

---

## HTTP Bridge (server.ts)

```
GET  /health   → { status, uptimeMs, version, model }
GET  /metrics  → { requests, totalTokens, totalCostUsd, errors }
POST /chat     { message, history?, model? } → { text }
POST /stream   { message, history?, model? } → SSE  data: {"text":"…"} … [DONE]
```

Optional `Authorization: Bearer <key>` enforcement. CORS enabled by default.

---

## Provider Swap

`baseUrl` is the only thing that changes per provider:

| Provider   | baseUrl                          |
|------------|----------------------------------|
| OpenAI     | `https://api.openai.com/v1`      |
| OpenRouter | `https://openrouter.ai/api/v1`   |
| Groq       | `https://api.groq.com/openai/v1` |
| Ollama     | `http://localhost:11434/v1`      |

---

## What's NOT here (intentional)

- **No SDK deps** — `fetch` + SSE is all we need; avoids version drift
- **No vector store** — pass `history` yourself or use `SlidingWindowMemory`
- **No build step** — Bun runs `.ts` directly; no `tsc`, no `dist/` folder
- **No persistent DB** — core stays stateless; integrate your own storage if needed
- **No framework coupling** — plain classes and functions, not a DSL
