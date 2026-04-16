# Silvi — Architecture & Design Decisions

## Goal
A small, fast, embeddable agent library that:
- works with any OpenAI-compatible API (OpenRouter, Groq, local Ollama, etc.)
- integrates natively into JS/TS bots (Telegram, Discord, FB Messenger, etc.)
- is usable from Python or any other language via an HTTP bridge
- enforces a **safe mode** so public-facing bots can't accidentally run destructive tools

---

## Language: TypeScript (Bun runtime)

**Why not Go?**
Go would produce a faster binary, but the primary use-case is a *library* that JS/TS bots
import directly. Shipping a Go binary as a library requires either:
- CGo bindings (complex, breaks cross-compilation)
- gRPC/HTTP (extra process + latency for the common case)

Go still makes sense if you later need a standalone daemon with no JS/TS consumers. If
that changes, the `server.ts` HTTP bridge already speaks a clean REST protocol — a Go
rewrite of just the core loop would be a drop-in backend.

**Why Bun over Node?**
- ~3× faster startup, faster `fetch`, ships TypeScript natively (no build step)
- Built-in `Bun.serve`, `Bun.spawn`, `Bun.file` cover 100% of our runtime needs
- Zero runtime deps — nothing to install beyond `bun` itself

---

## File Layout

```
src/
  types.ts    — shared interfaces (Message, Tool, AgentConfig, …)
  client.ts   — streaming OpenAI-compat HTTP client (pure fetch + SSE)
  tools.ts    — ToolRegistry: register, lookup, export to OpenAI format
  agent.ts    — Agent class: loop, safe-mode guard, run/chat/serve
  server.ts   — HTTP bridge: POST /chat (full) + POST /stream (SSE)
  index.ts    — public exports

tools/
  web.ts      — web_fetch  (safe=true)
  shell.ts    — shell      (safe=false)
  file.ts     — file_read  (safe=true), file_write (safe=false)
  index.ts    — re-export all built-ins

examples/
  basic.ts    — usage demo (streaming, safe mode, provider swap)
```

Each file has one job. `types.ts` is the single source of truth for interfaces so
nothing needs to import across multiple files to compose a type.

---

## Safe Mode

**Design:** every `Tool` carries a `safe: boolean` flag.
When `Agent.cfg.safeMode === true`, the agent refuses to call any tool where `safe=false`.
The refusal message is returned as the tool result so the LLM can explain why it couldn't act.

**Why flag-on-tool rather than an allowlist?**
- Easier to define once at tool creation time than to maintain a separate list per agent
- The agent can still override `safeMode=false` when you trust the caller (internal bots,
  CI scripts, etc.) — no need to re-register tools

**Built-in posture:**
| Tool        | safe  | Reason                                 |
|-------------|-------|----------------------------------------|
| web_fetch   | true  | read-only, no side effects             |
| file_read   | true  | read-only                              |
| shell       | false | arbitrary execution — opt-in only      |
| file_write  | false | can clobber files — opt-in only        |

---

## Agent Loop

```
user message
  │
  ▼
[ build messages: system + history + user ]
  │
  ▼ (repeat up to maxSteps)
[ stream LLM completion ]
  │
  ├─ text delta → yield to caller (streaming UX)
  └─ tool_calls → accumulate fragments (SSE arrives in pieces)
        │
        ▼
[ execute each tool (safe-mode check) ]
        │
        ▼
[ push tool results → messages ]
        │
        ▼ (loop back, or break if finish_reason ≠ tool_calls)
```

Streaming is first-class: `agent.chat()` is an `AsyncGenerator<string>` so callers
can forward tokens to Telegram/Discord in real time. `agent.run()` is a convenience
wrapper that collects the full string.

---

## HTTP Bridge (server.ts)

Lets Python bots (or any HTTP client) call the agent:

```
POST /chat    { message, history? }  →  { text: string }
POST /stream  { message, history? }  →  SSE  data: {"text":"..."} … data: [DONE]
```

The server is **lazy-loaded** (`import('./server.ts')`) so it doesn't pull in `Bun.serve`
unless `agent.serve()` is called — keeps the library clean when used as a pure import.

---

## Provider Swap

`baseUrl` is the only thing that changes per provider:

| Provider    | baseUrl                                | Notes                        |
|-------------|----------------------------------------|------------------------------|
| OpenAI      | https://api.openai.com/v1 (default)    |                              |
| OpenRouter  | https://openrouter.ai/api/v1           | prefix model with `openai/`  |
| Groq        | https://api.groq.com/openai/v1         | llama / mixtral models       |
| Ollama      | http://localhost:11434/v1              | apiKey can be any string     |

---

## What's NOT here (intentional)

- **No SDK deps** — `fetch` + SSE is all we need; avoids version drift
- **No memory / vector store** — pass `history` yourself; keeps the core stateless
- **No retry / backoff** — add at the caller level if needed; not every bot needs it
- **No build step** — Bun runs `.ts` directly; no `tsc`, no `dist/` folder needed
