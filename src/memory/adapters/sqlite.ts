// SQLite Persistence Adapter
// Saves and loads MemorySnapshot using Bun's native lightning-fast sqlite client.

import { Database } from 'bun:sqlite'
import type { MemoryPersist, MemorySnapshot } from '../types.ts'

export class SQLiteAdapter implements MemoryPersist {
  private db: Database

  constructor(filePath: string) {
    this.db = new Database(filePath)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT NOT NULL,
        saved_at INTEGER NOT NULL
      )
    `)
  }

  async save(snapshot: MemorySnapshot): Promise<void> {
    const data = JSON.stringify(snapshot)
    const query = this.db.prepare(`
      INSERT INTO memory_snapshot (id, data, saved_at) 
      VALUES (1, $data, $saved_at)
      ON CONFLICT(id) DO UPDATE SET data = $data, saved_at = $saved_at
    `)
    query.run({ $data: data, $saved_at: snapshot.savedAt })
  }

  async load(): Promise<MemorySnapshot | null> {
    const row = this.db.query<{ data: string }>(`SELECT data FROM memory_snapshot WHERE id = 1`).get()
    
    if (!row) return null

    try {
      return JSON.parse(row.data) as MemorySnapshot
    } catch {
      return null
    }
  }

  close() {
    this.db.close()
  }
}
