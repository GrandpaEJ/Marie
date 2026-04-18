# Getting Started

Learn how to build your first high-performance agent with **Marie**.

## 1. Installation

Install Marie via GitHub:

```bash
bun add https://github.com/GrandpaEJ/Marie.git
```

## 2. Configuration

Marie uses a `.env` file for credentials. Create one in the root directory:

```env
AI_MODEL=gpt-4o-mini
AI_API_KEY=your_key_here
AI_BASE_URL=https://api.openai.com/v1
TG_TOKEN=your_telegram_bot_token (optional)
```

## 3. Your First Agent

Create a file named `my-agent.ts`:

```typescript
import { Agent } from "@grandpaej/marie";

const agent = new Agent({
  model: process.env.AI_MODEL!,
  apiKey: process.env.AI_API_KEY!,
  systemPrompt: "You are a helpful assistant."
});

const response = await agent.run("Hello! What can you do?");
console.log(response);
```

Run it with Bun:
```bash
bun run my-agent.ts
```

## 4. Why Marie?

Marie is designed for **Production v1** scenarios:
- **Zero Dependencies**: Pure TypeScript, lightning fast on Bun.
- **Cost Aware**: Built-in token budgets and semantic caching.
- **Persistent Memory**: Human-like memory that survives restarts.
- **Multi-Tenant**: Native support for thousands of users (e.g., Telegram bots).
