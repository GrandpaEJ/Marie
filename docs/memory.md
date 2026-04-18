# Associative Memory

Marie uses a unique **Associative Memory** system that mimics human cognitive architecture. Rather than just storing a list of past messages, Marie extracts **Facts** and **Summaries** to keep the context relevant and the token cost low.

## The Dual-Layer System

### 1. Short-Term Memory (STM)
STM handles the immediate context of the conversation.
- **Sliding Window**: It keeps the last $N$ turns verbatim for perfect recall of recent context.
- **Recursive Summarization**: As the conversation grows, older messages are compressed into summaries (bullets or paragraphs).
- **Graceful Decay**: When the summary stack gets too tall, the oldest summaries are dropped, preventing infinite token growth while preserving "essence".

### 2. Long-Term Memory (LTM)
LTM acts as a permanent, categorized knowledge base about the user.
- **Declarative Extraction**: Every user message is passed to an `Extractor` that identifies permanent facts (e.g., "User is a Go developer").
- **Relational Storage**: Facts are stored in a normalized SQLite schema with metadata (importance, timestamps, usage counts).
- **Associative Retrieval**: Before each turn, Marie queries the LTM for facts relevant to the current user input and injects them as a "Preamble".

---

## The Lifecycle of a Fact

1.  **Ingestion**: User says "Actually, I prefer Bun over Node."
2.  **Extraction**: The `MemoryMiddleware` identifies this as a preference category fact.
3.  **Deduplication**: Marie checks the LTM for existing facts about "Bun" or "preferences" to avoid duplicates.
4.  **Consolidation**: The fact is stored in the `ltm_nodes` table, tagged with the `userId`.
5.  **Reactivation**: Next week, the user asks "What runtime should I use?". Marie searches LTM, finds the "prefers Bun" fact, and injects it into the LLM prompt.

---

## Multi-User Scoping

In production environments (like a Telegram bot), isolation is critical. Marie solves this via **Metadata Scoping**.

```typescript
// Pass the owner's ID in the chat call
await agent.chat("Remember my name?", {
  metadata: { userId: "user_789" }
});
```

The memory system will automatically:
-   **Retrieve** only facts tagged with `user_789`.
-   **Summarize** only the conversation history for `user_789`.
-   **Store** new facts with the `user_789` ownership tag.

## Performance Note

Marie's memory uses **Bun's native SQLite** with **Write-Ahead Logging (WAL)**. Retrieval of relevant facts generally takes **< 10ms**, even with thousands of users and tens of thousands of facts.
