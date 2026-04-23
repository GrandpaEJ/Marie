import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'marie.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

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
    role      TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content   TEXT NOT NULL,
    tokens    INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
  );
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, timestamp);

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
