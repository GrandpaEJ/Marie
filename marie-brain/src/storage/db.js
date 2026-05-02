import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '../../../data');
const DB_PATH = path.join(DB_DIR, 'marie.db');
// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}
const db = new DatabaseSync(DB_PATH);
// Enable WAL mode for better concurrent performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
// Migrations / Schema setup
db.exec(`
  -- Users & RBAC
  CREATE TABLE IF NOT EXISTS users (
    uid       TEXT PRIMARY KEY,
    role      TEXT DEFAULT 'user' CHECK(role IN ('owner','admin','user')),
    name      TEXT,
    created   INTEGER DEFAULT (unixepoch()),
    updated   INTEGER DEFAULT (unixepoch())
  );

  -- Thread config
  CREATE TABLE IF NOT EXISTS threads (
    thread_id TEXT PRIMARY KEY,
    persona   TEXT,
    model     TEXT,
    nsfw      INTEGER DEFAULT 0,
    rp_enabled INTEGER DEFAULT 1,
    created   INTEGER DEFAULT (unixepoch()),
    updated   INTEGER DEFAULT (unixepoch())
  );

  -- Conversation history
  CREATE TABLE IF NOT EXISTS messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    uid       TEXT,
    role      TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content   TEXT NOT NULL,
    tokens    INTEGER DEFAULT 0,
    archived  INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
  );
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_active ON messages(thread_id, archived, timestamp);

  -- Memory: Per-user facts (global across all threads)
  CREATE TABLE IF NOT EXISTS memory_facts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    uid       TEXT NOT NULL,
    category  TEXT NOT NULL CHECK(category IN ('name','age','preference','relationship','location','trait','identity','other')),
    fact_key  TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source_thread TEXT,
    created   INTEGER DEFAULT (unixepoch()),
    updated   INTEGER DEFAULT (unixepoch()),
    UNIQUE(uid, category, fact_key)
  );
  CREATE INDEX IF NOT EXISTS idx_facts_uid ON memory_facts(uid);

  -- Memory: Per-thread LTM summaries
  CREATE TABLE IF NOT EXISTS memory_summaries (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id      TEXT NOT NULL,
    summary        TEXT NOT NULL,
    from_timestamp INTEGER NOT NULL,
    to_timestamp   INTEGER NOT NULL,
    msg_count      INTEGER DEFAULT 0,
    created        INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
  );
  CREATE INDEX IF NOT EXISTS idx_summaries_thread ON memory_summaries(thread_id, created);

  -- FTS5 Virtual Tables for Full-text search (BM25)
  CREATE VIRTUAL TABLE IF NOT EXISTS fts_facts USING fts5(
    uid UNINDEXED,
    category UNINDEXED,
    fact_key,
    fact_value,
    content='memory_facts',
    content_rowid='id'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS fts_summaries USING fts5(
    thread_id UNINDEXED,
    summary,
    content='memory_summaries',
    content_rowid='id'
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS trg_facts_insert AFTER INSERT ON memory_facts BEGIN
    INSERT INTO fts_facts(rowid, uid, category, fact_key, fact_value) VALUES (new.id, new.uid, new.category, new.fact_key, new.fact_value);
  END;
  CREATE TRIGGER IF NOT EXISTS trg_facts_delete AFTER DELETE ON memory_facts BEGIN
    INSERT INTO fts_facts(fts_facts, rowid, uid, category, fact_key, fact_value) VALUES('delete', old.id, old.uid, old.category, old.fact_key, old.fact_value);
  END;
  CREATE TRIGGER IF NOT EXISTS trg_facts_update AFTER UPDATE ON memory_facts BEGIN
    INSERT INTO fts_facts(fts_facts, rowid, uid, category, fact_key, fact_value) VALUES('delete', old.id, old.uid, old.category, old.fact_key, old.fact_value);
    INSERT INTO fts_facts(rowid, uid, category, fact_key, fact_value) VALUES (new.id, new.uid, new.category, new.fact_key, new.fact_value);
  END;

  CREATE TRIGGER IF NOT EXISTS trg_summaries_insert AFTER INSERT ON memory_summaries BEGIN
    INSERT INTO fts_summaries(rowid, thread_id, summary) VALUES (new.id, new.thread_id, new.summary);
  END;
  CREATE TRIGGER IF NOT EXISTS trg_summaries_delete AFTER DELETE ON memory_summaries BEGIN
    INSERT INTO fts_summaries(fts_summaries, rowid, thread_id, summary) VALUES('delete', old.id, old.thread_id, old.summary);
  END;

  -- Token usage analytics
  CREATE TABLE IF NOT EXISTS token_usage (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id    TEXT NOT NULL,
    uid          TEXT,
    model        TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd     REAL DEFAULT 0,
    timestamp    INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_usage_thread ON token_usage(thread_id);
  CREATE INDEX IF NOT EXISTS idx_usage_uid ON token_usage(uid);
`);
export default db;
