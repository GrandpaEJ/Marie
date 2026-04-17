# 🕊️ Marie (Silvi v1)

**Marie** (formerly Silvi) is a high-performance, cost-optimized AI agent framework built for **Bun**. It is designed to be the "perfect" agent: scalable, easy to manage, low cost, and high value.

Whether you're building a simple bot for Telegram or a complex multi-agent orchestration system, Marie provides the production-grade primitives you need without the bloat of traditional SDKs.

---

## ✨ Key Features

- 🚀 **Lightning Fast**: Built on Bun with zero runtime dependencies.
- 💰 **Built-in Cost Control**: Intelligent model routing, semantic caching, and hard token/USD budgets.
- 🧘 **Provider Agnostic**: Works natively with OpenAI, OpenRouter, Groq, Anthropic, and local Ollama.
- 👥 **Multi-Agent Orchestration**: Out-of-the-box support for Supervisor, Pipeline, and Parallel patterns.
- 🛡️ **Safe Mode**: Granular tool permissions to prevent unintended destructive actions.
- 📦 **Stateless & Scalable**: Use as a library or via the built-in HTTP bridge for cross-language support.
- 📱 **Telegram Integrated**: One-line deployment for streaming Telegram bots.

---

## 🚀 Quick Start

### 1. Installation

Ensure you have [Bun](https://bun.sh) installed.

```bash
git clone https://github.com/GrandpaEJ/Marie.git
cd Marie
bun install
```

### 2. Configure Environment

Create a `.env` file:

```env
AI_MODEL=gpt-4o-mini
AI_API_KEY=your_key_here
AI_BASE_URL=https://zero-bot.net/api/ai/v1
TG_TOKEN=your_telegram_bot_token (optional)
```

### 3. Run Your First Agent

```typescript
import { Agent } from "./src/index.ts";
import { webFetch } from "./tools/index.ts";

const agent = new Agent({
  model: process.env.AI_MODEL,
  apiKey: process.env.AI_API_KEY,
}).register(webFetch);

const response = await agent.run("What's the current price of Bitcoin?");
console.log(response);
```

---

## 💎 Cost-Aware Intelligence

Marie is designed to save you money. Most queries don't need a frontier model ($$$).

### 🧬 Model Routing

The `ModelRouter` classifies query complexity and routes tasks to the cheapest viable model.

- **Simple factual queries** → Route to `gpt-4.1-nano` or `llama3-8b`.
- **Complex reasoning** → Route to `gpt-4o` or `claude-3.5-sonnet`.

### ⚡ Semantic Caching

Repeat queries are served instantly from the LRU cache at **$0 cost**.

### 🛑 Hard Budgets

Set hard caps on tokens or USD spend per run:

```typescript
budget: {
  maxCostUsd: 0.10, // Kill the run if it costs > 10 cents
  maxTokens: 5000,
  warnAt: 0.8
}
```

---

## 💠 Multi-Agent Patterns

Marie makes orchestration simple:

| Pattern        | Module       | Use Case                                                    |
| :------------- | :----------- | :---------------------------------------------------------- |
| **Supervisor** | `Supervisor` | Central brain delegates to specialists (Coder, Researcher). |
| **Pipeline**   | `Pipeline`   | Sequential workflows (Outline → Draft → Edit).              |
| **Parallel**   | `Parallel`   | Split-and-merge parallel task execution.                    |

---

## 🛠️ Built-in Tools

Marie comes with pre-built, safety-aware tools:

- **Web Fetch**: Markdown-friendly URL extraction.
- **Shell**: Buffered, timed command execution (Requires `safeMode: false`).
- **Files**: Sandbox-aware read/write operations.

---

## 📊 Observability

Marie logs everything in structured JSON to `stderr`. It also provides a production HTTP bridge with:

- `GET /health`: System status and uptime.
- `GET /metrics`: Real-time request counts, token usage, and accumulated USD cost.

---

## 📝 License

MIT
