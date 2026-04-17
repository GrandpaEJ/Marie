// Relational SQLite Persistence Adapter
// Saves and loads MemorySnapshot using Bun's native sqlite client.
// v1.1: Added user_id scoping to all tables to support multi-tenant deployments.

import { Database } from 'bun:sqlite'
import type { MemoryPersist, MemorySnapshot, MemoryNode, FactCategory } from '../types.ts'

export class SQLiteAdapter implements MemoryPersist {
  private db: Database

  constructor(filePath: string) {
    this.db = new Database(filePath)
    this.init()
  }

  private init() {
    this.db.exec('PRAGMA journal_mode = WAL;')

    // Added user_id to both tables for isolation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ltm_nodes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        importance REAL NOT NULL,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        access_count INTEGER NOT NULL,
        tags TEXT NOT NULL,
        source TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stm_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        content TEXT NOT NULL
      );
    `)
  }

  async save(snapshot: MemorySnapshot): Promise<void> {
    const insertLtm = this.db.prepare(`
      INSERT INTO ltm_nodes (id, user_id, content, category, importance, created_at, last_accessed_at, access_count, tags, source) 
      VALUES ($id, $user_id, $content, $category, $importance, $created_at, $last_accessed_at, $access_count, $tags, $source)
      ON CONFLICT(id) DO UPDATE SET 
        importance = $importance,
        last_accessed_at = $last_accessed_at,
        access_count = $access_count
    `)

    const insertStm = this.db.prepare(`INSERT INTO stm_summaries (user_id, content) VALUES ($user_id, $content)`)

    const transaction = this.db.transaction(() => {
      // 1. Sync LTM nodes
      for (const node of snapshot.ltm) {
        insertLtm.run({
          $id: node.id,
          $user_id: node.userId ?? null,
          $content: node.content,
          $category: node.category,
          $importance: node.importance,
          $created_at: node.createdAt,
          $last_accessed_at: node.lastAccessedAt,
          $access_count: node.accessCount,
          $tags: JSON.stringify(node.tags),
          $source: node.source,
        })
      }

      // 2. Sync STM Summaries
      // If snapshot.userId is provided, we only purge and sync that user.
      // If it's a global sync, we handle accordingly.
      if (snapshot.userId) {
        const del = this.db.prepare('DELETE FROM stm_summaries WHERE user_id = ?')
        del.run(snapshot.userId)
      } else {
        this.db.exec('DELETE FROM stm_summaries;')
      }

      for (const summary of snapshot.stmSummaries) {
        insertStm.run({ 
          $user_id: snapshot.userId ?? null, 
          $content: summary 
        })
      }
    })

    transaction()
  }

  async load(): Promise<MemorySnapshot | null> {
    try {
      // Load ALL LTM for all users (Memory manager filters them in-memory)
      const ltmRows = this.db.query<any, []>(`SELECT * FROM ltm_nodes`).all()
      const ltm: MemoryNode[] = ltmRows.map(row => ({
        id: row.id as string,
        userId: row.user_id as string,
        content: row.content as string,
        category: row.category as FactCategory,
        importance: row.importance as number,
        createdAt: row.created_at as number,
        lastAccessedAt: row.last_accessed_at as number,
        accessCount: row.access_count as number,
        tags: JSON.parse(row.tags as string),
        source: row.source as 'heuristic' | 'llm',
      }))

      // Load ALL STM summaries
      const stmRows = this.db.query<any, []>(`SELECT * FROM stm_summaries ORDER BY id ASC`).all()
      
      // Note: In v1.1, the Memory manager's load() expects a single array of summaries.
      // If the adapter is used for massive multi-tenancy, the Memory manager itself
      // might need a minor upgrade to handle the segmented loading.
      // For now, we return the global set to stay compatible with Memory.load().
      const stmSummaries = stmRows.map(row => row.content)

      if (ltm.length === 0 && stmSummaries.length === 0) return null

      return {
        ltm,
        stmSummaries,
        savedAt: Date.now(),
      }
    } catch {
      return null
    }
  }

  close() {
    this.db.close()
  }
}
