# Persistence Adapters

Marie is designed to be pluggable. You can store your agent's memory in any database by implementing the `MemoryPersist` interface.

## 1. Built-in Adapters

Marie provides two ultra-fast, zero-dependency adapters out-of-the-box using Bun internals.

### SQLite Adapter (Recommended)
Uses Bun's native lightning-fast `bun:sqlite` with relational tables for easy external querying.

```typescript
import { SQLiteAdapter } from "silvi";

const adapter = new SQLiteAdapter("memories.sqlite");
```

### JSON Adapter
A simple, human-readable file fallback that uses `Bun.file()`.

```typescript
import { JSONAdapter } from "silvi";

const adapter = new JSONAdapter("memories.json");
```

## 2. Custom Adapters

To use MongoDB, PostgreSQL, redis, or others, simply implement the `save` and `load` methods.

```typescript
import { MemoryPersist, MemorySnapshot } from "silvi";

class MyCustomAdapter implements MemoryPersist {
  async save(snapshot: MemorySnapshot) {
    // Write to your DB
  }

  async load(): Promise<MemorySnapshot | null> {
    // Read from your DB
  }
}
```

## 3. Atomic Transactions

The built-in `SQLiteAdapter` uses `WAL` (Write-Ahead Logging) and atomic transactions to ensure that memory is never corrupted even if your bot crashes mid-turn.
