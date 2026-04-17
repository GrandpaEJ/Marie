// Relational SQLite Persistence Adapter
// Saves and loads MemorySnapshot using Bun's native sqlite client.
// Normalized tables allow external analytics and direct SQL FTS querying natively!

import { Database } from 'bun:sqlite'
import type { MemoryPersist, MemorySnapshot, MemoryNode, FactCategory } from '../types.ts'

export class SQLiteAdapter implements MemoryPersist {
  private db: Database

  constructor(filePath: string) {
    this.db = new Database(filePath)
    this.init()
  }

  private init() {
    // We use WAL mode for max performance
    this.db.exec('PRAGMA journal_mode = WAL;')

    // Relational tables instead of JSON blobs for easy external queries
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ltm_nodes (
        id TEXT PRIMARY KEY,
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
        content TEXT NOT NULL
      );
    `)
  }

  async save(snapshot: MemorySnapshot): Promise<void> {
    const insertLtm = this.db.prepare(`
      INSERT INTO ltm_nodes (id, content, category, importance, created_at, last_accessed_at, access_count, tags, source) 
      VALUES ($id, $content, $category, $importance, $created_at, $last_accessed_at, $access_count, $tags, $source)
      ON CONFLICT(id) DO UPDATE SET 
        importance = $importance,
        last_accessed_at = $last_accessed_at,
        access_count = $access_count
    `)

    const insertStm = this.db.prepare(`INSERT INTO stm_summaries (content) VALUES ($content)`)

    // Database transaction to ensure atomic saves
    const transaction = this.db.transaction(() => {
      // 1. Sync LTM nodes (Insert or Update)
      for (const node of snapshot.ltm) {
        insertLtm.run({
          $id: node.id,
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
      // Because STM is a sliding window, we simply clear the table and insert the active window
      this.db.exec('DELETE FROM stm_summaries;')
      for (const summary of snapshot.stmSummaries) {
        insertStm.run({ $content: summary })
      }
    })

    transaction()
  }

  async load(): Promise<MemorySnapshot | null> {
    try {
      // Load LTM
      const ltmRows = this.db.query<any, []>(`SELECT * FROM ltm_nodes`).all()
      const ltm: MemoryNode[] = ltmRows.map(row => ({
        id: row.id as string,
        content: row.content as string,
        category: row.category as FactCategory,
        importance: row.importance as number,
        createdAt: row.created_at as number,
        lastAccessedAt: row.last_accessed_at as number,
        accessCount: row.access_count as number,
        tags: JSON.parse(row.tags as string),
        source: row.source as 'heuristic' | 'llm',
      }))

      // Load STM Summaries
      const stmRows = this.db.query<{ content: string }, []>(`SELECT content FROM stm_summaries ORDER BY id ASC`).all()
      const stmSummaries = stmRows.map(row => row.content)

      // If entirely empty, return null so memory system knows there's no pre-existing state
      if (ltm.length === 0 && stmSummaries.length === 0) {
        return null
      }

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
