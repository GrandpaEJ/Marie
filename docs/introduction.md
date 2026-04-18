# Introduction

**Marie** (@grandpaej/marie) is a minimal, high-performance agent framework built for **Bun**. It is designed to be the "perfect" agent: scalable, cost-optimized, and extremely easy to embed in real-world applications.

## The Marie Philosophy

In a world of bloated AI frameworks, Marie stands for **radical minimalism**.

1.  **Zero Runtime Dependencies**: Marie is built exclusively on Bun's native APIs (`fetch`, `sqlite`, `serve`). It does not rely on heavy vendor SDKs. This means faster cold starts, zero version drift, and a tiny memory footprint.
2.  **Stateless by Choice**: The core library flows data through ephemeral pipelines. Persistence is a choice, not a mandate.
3.  **Economic Intelligence**: Cost is a first-class citizen. Marie assumes you are on a budget and provides tools to enforce it.
4.  **Human-like Memory**: Unlike standard RAG which just pulls text blocks, Marie's "Associative Memory" extracts facts and preferences into a relational MIND.

## Why Bun?

Marie was built for the Bun runtime. While it can run elsewhere, it leverages Bun for:
- **Performance**: Sub-5ms SQLite queries and lightning-fast streaming.
- **Ergonomics**: Direct execution of TypeScript files (`.ts`) with no build step.
- **Native SQL**: Utilizing `bun:sqlite` for high-concurrency multi-user memory.

## Comparison

| Feature | Marie | LangChain / CrewAI |
| :--- | :--- | :--- |
| **Footprint** | Tiny (< 60kb bundled) | Large (100s of MBs) |
| **Startup** | Near-instant | Significant lag |
| **Logic** | Plain TypeScript Classes | Complex DSLs / Abstractions |
| **Cost Control** | Built-in Budgets & Routing | External plugins usually |
| **Setup** | `bun install` | Complex environment config |

## Is Marie for you?

Marie is for developers who want to **ship products**, not just research experiments. If you need a state-of-the-art memory system that can handle 10,000 Telegram users without breaking the bank, you are in the right place.
