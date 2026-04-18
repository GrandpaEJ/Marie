# Telegram Bot Tutorial

In this tutorial, we will build a production-grade Telegram bot that remembers everything about its users to a permanent SQL database.

## Prerequisites
- A Telegram Bot Token from [@BotFather](https://t.me/botfather).
- Marie library installed.
- Bun runtime.

## 1. The Strategy

We want a bot that:
-   **Streams** responses (edits messages in real-time).
-   **Remembers** facts (using the Associative Memory).
-   **Isolates** users (User A's memory stays with User A).

## 2. Setting Up Memory

First, we initialize our `Memory` with the `SQLiteAdapter`.

```typescript
import { Memory, SQLiteAdapter, createMemoryMiddleware } from "@grandpaej/marie";

const memory = new Memory({
  persist: new SQLiteAdapter("telegram-bot.sqlite"),
  maxStmSummaries: 5
});

// Load the database from disk
await memory.load();
```

## 3. Configuring the Agent

We wire the memory into the agent using **Middleware**. This ensures every turn is saved automatically.

```typescript
import { Agent } from "@grandpaej/marie";

const agent = new Agent({
  model: "gpt-4o",
  apiKey: process.env.AI_API_KEY!,
  systemPrompt: "You are a helpful companion. Use your memory to personalize chats.",
  middleware: [
    createMemoryMiddleware(memory)
  ]
});
```

## 4. Launching the Telegram Adapter

Marie includes a native Telegram adapter that handles the complexities of long-polling and message editing.

```typescript
import { telegramAdapter } from "@grandpaej/marie/integrations";

telegramAdapter(agent, {
  token: process.env.TG_TOKEN!,
  externalHistory: true, // Let the MemoryMiddleware handle the context
  startMessage: "Hello! I am your AI. I remember everything we discuss.",
  pollIntervalMs: 500
});
```

## 5. How it Works (Under the Hood)

When a message arrives from Telegram:
1.  The adapter identifies the `userId` (the Telegram chat ID).
2.  It passes this `userId` into the `agent.chat()` call via metadata.
3.  The **MemoryMiddleware** interceptor sees the `userId`.
4.  It queries the SQLite DB for facts belonging to ONLY that user.
5.  It injects those facts into the prompt before the AI sees it.

## 6. Going to Production

To keep your bot running 24/7, we recommend using a process manager like **PM2** or a simple **systemd** service.

```bash
# Registering with PM2
pm2 start index.ts --interpreter bun --name "marie-bot"
```

You now have a production-ready, stateful AI agent on Telegram in under 50 lines of code!
