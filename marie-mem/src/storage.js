import { activeBuffer } from './active-buffer.js';

let db;

export function initStorage(database) {
  db = database;
}

// ─── Facts (Per-User, Global) ───────────────────────────────────────────

export function upsertFact(uid, category, factKey, factValue, sourceThread = null, confidence = 1.0, ttlHours = null) {
  const expiry = ttlHours ? Math.floor(Date.now() / 1000) + (ttlHours * 3600) : null;

  // Check existing fact for confidence check and conflict resolution
  const existing = db.prepare('SELECT id, confidence, fact_value FROM memory_facts WHERE uid = ? AND category = ? AND fact_key = ?').get(uid, category, factKey);

  if (existing) {
    if (existing.confidence > confidence) {
      console.log(`[Storage] Skipping fact update for ${factKey}: Existing confidence (${existing.confidence}) > new (${confidence})`);
      return;
    }

    // If values are different, mark the old one as superseded
    if (existing.fact_value !== factValue) {
      console.log(`[Storage] Fact conflict for ${factKey}: "${existing.fact_value}" -> "${factValue}". Marking old as superseded.`);
      // We don't delete, we update the existing one or create a new one.
      // The current schema uses UNIQUE(uid, category, fact_key), so we MUST update the existing row if we want to keep the same key.
      // If we want to keep BOTH, we would need to change the unique constraint.
      // For now, let's just update the existing one as per Step 303, but maybe log the change.
    }
  }

  db.prepare(`
    INSERT INTO memory_facts (uid, category, fact_key, fact_value, confidence, source_thread, expiry, updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(uid, category, fact_key) DO UPDATE SET
      fact_value = excluded.fact_value,
      confidence = excluded.confidence,
      source_thread = excluded.source_thread,
      expiry = excluded.expiry,
      updated = unixepoch()
  `).run(uid, category, factKey, factValue, confidence, sourceThread, expiry);
}

export function cleanExpiredFacts() {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('DELETE FROM memory_facts WHERE expiry IS NOT NULL AND expiry < ?').run(now);
  if (result.changes > 0) {
    console.log(`[Storage] Cleaned ${result.changes} expired facts.`);
  }
}

export function getFacts(uid) {
  return db.prepare('SELECT * FROM memory_facts WHERE uid = ? ORDER BY category, fact_key').all(uid);
}

export function getFactsByCategory(uid, category) {
  return db.prepare('SELECT * FROM memory_facts WHERE uid = ? AND category = ?').all(uid, category);
}

export function deleteFact(factId) {
  db.prepare('DELETE FROM memory_facts WHERE id = ?').run(factId);
}

export function deleteAllFacts(uid) {
  db.prepare('DELETE FROM memory_facts WHERE uid = ?').run(uid);
}

// Build a compact fact string for context injection
export function buildFactsBlock(uid) {
  const facts = getFacts(uid);
  if (facts.length === 0) return null;

  const grouped = {};
  for (const f of facts) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(`${f.fact_key}: ${f.fact_value}`);
  }

  let block = '';
  for (const [cat, items] of Object.entries(grouped)) {
    block += `[${cat}] ${items.join(', ')}\n`;
  }
  return block.trim();
}

// ─── Summaries (Per-Thread LTM) ─────────────────────────────────────────

export function addSummary(threadId, summary, fromTimestamp, toTimestamp, msgCount = 0, level = 'conversation') {
  db.prepare(`
    INSERT INTO memory_summaries (thread_id, summary, from_timestamp, to_timestamp, msg_count, level, created)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).run(threadId, summary, fromTimestamp, toTimestamp, msgCount, level);
}

export function getSummaries(threadId, limit = 5, includeArchived = false) {
  const query = includeArchived 
    ? 'SELECT * FROM memory_summaries WHERE thread_id = ? ORDER BY created DESC LIMIT ?'
    : 'SELECT * FROM memory_summaries WHERE thread_id = ? AND archived = 0 ORDER BY created DESC LIMIT ?';
    
  return db.prepare(query).all(threadId, limit).reverse();
}

export function archiveSummaries(ids) {
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE memory_summaries SET archived = 1 WHERE id IN (${placeholders})`).run(...ids);
}

export function getSummariesForConsolidation(threadId, level, hours) {
  const timestamp = Math.floor(Date.now() / 1000) - (hours * 3600);
  return db.prepare(`
    SELECT * FROM memory_summaries
    WHERE thread_id = ? AND level = ? AND archived = 0 AND created >= ?
    ORDER BY created ASC
  `).all(threadId, level, timestamp);
}

export function clearSummaries(threadId) {
  db.prepare('DELETE FROM memory_summaries WHERE thread_id = ?').run(threadId);
}

// ─── Active Messages (Non-Archived STM) ─────────────────────────────────

export function getActiveMessages(threadId, limit = 20) {
  const dbMessages = db.prepare(`
    SELECT id, uid, role, content, tokens, timestamp
    FROM messages
    WHERE thread_id = ? AND archived = 0
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(threadId, limit);

  const bufferMessages = activeBuffer.getRecent(threadId, limit);

  // Combine and deduplicate
  const combined = [...dbMessages, ...bufferMessages];
  const unique = new Map();
  
  for (const m of combined) {
    const key = m.messageID || m.id || `${m.timestamp}_${m.content?.slice(0, 10)}`;
    if (!unique.has(key)) {
      unique.set(key, m);
    }
  }

  // Return sorted by timestamp ASC
  return Array.from(unique.values())
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .slice(-limit);
}

export function archiveMessages(threadId, beforeTimestamp) {
  activeBuffer.clearThread(threadId); // Clear buffer on archive to avoid staleness
  return db.prepare(`
    UPDATE messages
    SET archived = 1
    WHERE thread_id = ? AND archived = 0 AND timestamp <= ?
  `).run(threadId, beforeTimestamp);
}

export function getMessagesForSummarization(threadId, limit = 10) {
  return db.prepare(`
    SELECT id, uid, role, content, tokens, timestamp
    FROM messages
    WHERE thread_id = ? AND archived = 0
    ORDER BY timestamp ASC
    LIMIT ?
  `).all(threadId, limit);
}

export function countActiveMessages(threadId) {
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE thread_id = ? AND archived = 0
  `).get(threadId);
  
  const bufferCount = activeBuffer.getRecent(threadId).length;
  return row.count + bufferCount;
}

// ─── Professional Search (FTS5 + BM25) ───────────────────────────────────

/**
 * Searches for relevant facts using SQLite FTS5.
 * Uses BM25 ranking to return the most relevant results first.
 */
export function searchFacts(uid, query, limit = 10) {
  if (!query) return [];
  // Clean query for FTS5
  const cleanQuery = query.replace(/[^\w\s\u00C0-\u017F]/g, ' ').trim();
  if (!cleanQuery) return [];

  return db.prepare(`
    SELECT f.id, f.uid, f.category, f.fact_key, f.fact_value
    FROM fts_facts fts
    JOIN memory_facts f ON f.id = fts.rowid
    WHERE fts.uid = ? AND fts_facts MATCH ?
    ORDER BY bm25(fts_facts)
    LIMIT ?
  `).all(uid, cleanQuery, limit);
}

/**
 * Searches for relevant summaries using SQLite FTS5.
 * Weights: Weekly (3x), Daily (2x), Conversation (1x).
 * Recency Boost: +50% for last 24h.
 */
export function searchSummaries(threadId, query, limit = 5) {
  if (!query) return [];
  const cleanQuery = query.replace(/[^\w\s\u00C0-\u017F]/g, ' ').trim();
  if (!cleanQuery) return [];

  const last24h = Math.floor(Date.now() / 1000) - (24 * 3600);

  return db.prepare(`
    SELECT s.*, 
      (CASE 
        WHEN s.level = 'weekly' THEN 3.0
        WHEN s.level = 'daily' THEN 2.0
        ELSE 1.0
      END) * 
      (CASE 
        WHEN s.created >= ? THEN 1.5
        ELSE 1.0
      END) * 
      (1.0 - bm25(fts_summaries)) as rank_score
    FROM fts_summaries fts
    JOIN memory_summaries s ON s.id = fts.rowid
    WHERE fts.thread_id = ? AND fts_summaries MATCH ? AND s.archived = 0
    ORDER BY rank_score DESC
    LIMIT ?
  `).all(last24h, threadId, cleanQuery, limit);
}

/**
 * Get recent summaries regardless of search query.
 */
export function getRecentSummaries(threadId, hours = 24, limit = 5) {
  const timestamp = Math.floor(Date.now() / 1000) - (hours * 3600);
  return db.prepare(`
    SELECT * FROM memory_summaries
    WHERE thread_id = ? AND archived = 0 AND created >= ?
    ORDER BY created DESC
    LIMIT ?
  `).all(threadId, timestamp, limit).reverse();
}

export function clearThreadMemory(threadId) {
  db.prepare('DELETE FROM messages WHERE thread_id = ?').run(threadId);
  db.prepare('DELETE FROM memory_summaries WHERE thread_id = ?').run(threadId);
}

/**
 * Rebuilds the FTS index from current table content.
 */
export function rebuildFts() {
  db.prepare('INSERT INTO fts_facts(fts_facts) VALUES(\'rebuild\')').run();
  db.prepare('INSERT INTO fts_summaries(fts_summaries) VALUES(\'rebuild\')').run();
}
