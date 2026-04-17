# Associative Memory

Marie uses a sophisticated, multi-layered memory architecture designed to mimic human cognitive processes (STM vs LTM). This goes beyond simple RAG by extracting **facts** and **preferences** automatically.

## Memory Architecture

### 1. Short-Term Memory (STM)
A sliding window of recent conversation turns.
- **Verbatim**: The last few turns are kept exactly as they happened.
- **Summarization**: Older turns are compressed into bullet points or paragraphs to save tokens.
- **Auto-Forget**: Once a conversation reaches a certain length, the oldest summaries are dropped to keep context window costs stable.

### 2. Long-Term Memory (LTM)
A persistent, categorized fact store.
- **Fact Extraction**: Every user message is analyzed (via heuristic or LLM) to extract nodes like "User lives in Dhaka" or "User prefers TypeScript".
- **Relational SQL**: Facts are stored in indexed SQLite tables, allowing for sub-5ms retrieval.
- **Associative Search**: When a user asks a question, Marie performs a semantic search over the LTM to pull in relevant facts as context.

## How to Use

Simply register the `Memory` instance via the `MemoryMiddleware`:

```typescript
import { Memory, SQLiteAdapter, createMemoryMiddleware } from "silvi";

const memory = new Memory({
  persist: new SQLiteAdapter("my-memory.sqlite"),
  maxStmSummaries: 3,
});

// Load existing memory
await memory.load();

const agent = new Agent({
  // ... config
  middleware: [
    createMemoryMiddleware(memory)
  ]
});
```

## Multi-User Scoping

In production (e.g., a Telegram bot), you have many users. Marie handles this via `userId` scoping:

```typescript
// When running the agent, pass the userId in metadata
await agent.chat("Hi!", { 
  metadata: { userId: "user_123" } 
});
```

Marie will automatically:
1. Only inject facts belonging to `user_123`.
2. Only add new extracted facts to `user_123`'s bucket.
3. Keep `user_123`'s conversation summary isolated from others.
