# Marie Universal - Claude Code Guide

[Full documentation](./README.md) | [Architecture](./ARCHITECTURE.md)

## Project Overview

Marie is a high-performance, cross-platform AI agent framework powered by a Rust Universal Core. It works with any OpenAI-compatible API (OpenRouter, Groq, Ollama, etc.) and provides safe mode, cost control, and multi-language support.

## Development Setup

```bash
# Build Rust core + FFI bindings
bash build.sh

# Run TypeScript examples
bun run examples/basic.ts

# Build docs locally
bun run docs:dev
```

## Key Entry Points

| Language | Import | File |
|----------|--------|------|
| TypeScript | `Agent` | `src/index.ts` |
| Python | `MarieAgent` | `clients/python/marie/agent.py` |
| Rust | `Agent` | `marie-core/src/agent.rs` |

## Important Files

- `src/agent.ts` - Main agent logic
- `src/client.ts` - OpenAI-compatible API client
- `src/tools.ts` - Tool registry
- `marie-core/src/agent.rs` - Rust core agent
- `marie-core/src/tools/` - Rust tool implementations

## Adding a New Tool

1. TypeScript: Create in `tools/`, register in `src/tools.ts`
2. Rust: Add to `marie-core/src/tools/`
3. Set `safe: true` (read-only) or `safe: false` (requires safe_mode=False)

## Safe Mode

Tools with `safe: true` can run when `agent.safeMode = true`. Tools with `safe: false` require disabling safe mode.

## Testing

```bash
# TypeScript
bun run examples/basic.ts
bun run examples/telegram-bot.ts

# Python
python examples/persistence_test.py
python examples/python_usage.py

# Rust
cargo test --manifest-path marie-core/Cargo.toml
```

## New Features (v2)

### Tools
- `webSearch` - DuckDuckGo/SerpAPI web search
- `codeExecutor` - Safe Python/JS code execution

### Reasoning
- `src/reasoning.ts` - Chain-of-Thought, Reflexion, ReAct modes
- Use: `agent.use(createReasoningMiddleware({ mode: 'cot' }))`

### Memory
- `src/memory/semantic.ts` - Vector embedding memory
- `src/memory/middleware.ts` - Memory with entity tracking

### Persona
- `src/persona.ts` - Persona engine with voice styles
- Pre-built: `assistant`, `developer`, `friend`, `expert`, `teacher`
- `generateSystemPrompt(persona)` - Generate persona-specific prompts

### Safety
- `src/safety/input-filter.ts` - Input filtering, PII detection, audit logging

### Integrations
- `integrations/discord.ts` - Discord bot (slash commands)
- `integrations/slack.ts` - Slack app (Socket Mode)

## Common Patterns

- Model routing: edit `src/routing/models.ts`
- Middleware: use `agent.use({ before, after })`
- Bots: extend from `integrations/telegram.ts`
- Persona: import { PERSONAS, generateSystemPrompt } from './persona'
- Safety: import { createSafetyMiddleware } from './safety/input-filter'