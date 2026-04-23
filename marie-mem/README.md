# Marie v1 — Cognitive Memory System

This directory implements a professional, multi-tier cognitive memory architecture for Marie. It is designed to provide long-term continuity and user-awareness without the overhead or "randomness" of traditional vector RAG.

## 🧠 Architecture Overview

Marie's memory is divided into four distinct layers, each with a specific role and token budget:

| Tier | Name | Description | Scope | Budget |
| :--- | :--- | :--- | :--- | :--- |
| **Identity** | Core Persona | The bot's personality and self-knowledge. | Global | 15% |
| **Facts** | User Facts | Extracted user preferences, name, and traits. | Per-User | 10% |
| **LTM** | Long-Term Memory | Compressed summaries of past conversation arcs. | Per-Thread | 20% |
| **STM** | Short-Term Memory | Raw, recent message history (sliding window). | Per-Thread | 55% |

---

## 🔍 Retrieval Mechanism: FTS5 + BM25

Unlike "Vector RAG" which uses semantic embeddings (and can sometimes return irrelevant results), Marie uses **SQLite FTS5 (Full-Text Search)**.

- **BM25 Ranking**: We use the industry-standard BM25 algorithm to rank memories. When you send a message, Marie searches her Facts and LTM for the "Best Matching" fragments.
- **Deterministic**: If no relevant memory exists, nothing is injected. This prevents "hallucinated" context.
- **Language Agnostic**: Optimized for multi-language support (Bengali, English, Hindi, etc.) using Unicode-aware tokenization.

---

## ⚙️ How it Works (The Lifecycle)

### 1. Pre-Processing (Context Assembly)
When a message arrives, the `MemoryManager` performs a parallel search:
- **Always Load**: Identity facts (Name, Age) are always loaded.
- **Relevance Search**: Other facts and summaries are searched using the current message as a query via FTS5.
- **Packing**: The `ContextAssembler` packs these tiers into the prompt, ensuring the total token count stays within the `maxContextTokens` limit.

### 2. Post-Processing (Learning & Compression)
After Marie responds, two background tasks occur:
- **Fact Extraction**: The `FactExtractor` analyzes the turn to see if you disclosed anything new about yourself (e.g., "I like cats"). New facts are saved to the global `memory_facts` table.
- **Summarization**: When **STM** exceeds 15 messages, the `Summarizer` takes the oldest 10 messages, compresses them into a concise 2-3 sentence "Conversation Arc," stores it in **LTM**, and archives the raw messages.

---

## 🛠️ Management Commands

You can manage Marie's memory using the `.memory` command:
- `.memory stats`: See how many facts and summaries are currently active.
- `.memory facts`: List all facts Marie knows about you (with IDs).
- `.memory summaries`: View the compressed LTM arcs for the current thread.
- `.memory forget <id>`: Delete a specific fact.
- `.memory clear`: Wipe all thread-specific memory (STM + LTM).

---

## 📂 File Structure

- `index.js`: Package entry point.
- `src/memory-manager.js`: The central orchestrator (accepts dependencies).
- `src/context-assembler.js`: Handles token budgeting and prompt construction.
- `src/fact-extractor.js`: Lightweight LLM logic for learning about the user.
- `src/summarizer.js`: Compresses old history into LTM summaries.
- `src/storage.js`: FTS5-powered storage layer (accepts database instance).
- `src/tokenizer.js`: Shared token counting utilities.
