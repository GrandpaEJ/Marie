# Getting Started

Let's build your first AI agent. This guide will take you from a blank directory to a streaming agent capable of using tools.

## 1. Installation

Marie is designed for the **Bun** runtime. If you don't have it yet, install it from [bun.sh](https://bun.sh).

Install the Marie library:

```bash
bun add @grandpaej/marie
```

## 2. Setting up Credentials

Marie respects the `.env` convention. Create a file in your project root:

```env
AI_MODEL=gpt-4o
AI_API_KEY=sk-....
AI_BASE_URL=https://api.openai.com/v1
```

> [!TIP]
> Marie works with **any** OAI-compatible provider. You can swap `BASE_URL` to OpenRouter, Groq, or even a local Ollama instance.

## 3. Hello Marie

Create a file named `index.ts`. We'll start with a basic configuration.

```typescript
import { Agent } from "@grandpaej/marie";

const agent = new Agent({
  model: process.env.AI_MODEL!,
  apiKey: process.env.AI_API_KEY!,
  systemPrompt: "You are Marie, a concise and high-performance assistant."
});

// Run with standard output
const response = await agent.run("Tell me a joke about Bun.");
console.log(response);
```

Run it immediately:
```bash
bun run index.ts
```

## 4. Streaming (Better UX)

In production, you rarely want to wait for the full response. Marie provides an `async generator` interface for real-time streaming:

```typescript
const stream = agent.chat("Write a 500-word essay on AI safety.");

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## 5. Adding "Skills" (Tools)

Marie becomes truly powerful when you give her **Tools**. Let's add the built-in `webFetch` tool so she can browse the internet.

```typescript
import { webFetch } from "@grandpaej/marie/tools";

agent.register(webFetch);

// Now she can look things up:
await agent.run("What is the current version of Bun?");
```

Congratulations! You've just built a streaming, tool-enabled AI agent with zero bloat. Read on to the next chapter to learn how Marie's **Middleware Pipeline** works under the hood.
