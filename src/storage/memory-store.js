import db from './db.js';

// ─── Facts (Per-User, Global) ───────────────────────────────────────────

export function upsertFact(uid, category, factKey, factValue, sourceThread = null, confidence = 1.0) {
  db.prepare(`
    INSERT INTO memory_facts (uid, category, fact_key, fact_value, confidence, source_thread, created, updated)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(uid, category, fact_key) DO UPDATE SET
      fact_value = excluded.fact_value,
      confidence = excluded.confidence,
      source_thread = excluded.source_thread,
      updated = unixepoch()
  `).run(uid, category, factKey, factValue, confidence, sourceThread);
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

export function addSummary(threadId, summary, fromTimestamp, toTimestamp, msgCount = 0) {
  db.prepare(`
    INSERT INTO memory_summaries (thread_id, summary, from_timestamp, to_timestamp, msg_count, created)
    VALUES (?, ?, ?, ?, ?, unixepoch())
  `).run(threadId, summary, fromTimestamp, toTimestamp, msgCount);
}

export function getSummaries(threadId, limit = 5) {
  return db.prepare(`
    SELECT * FROM memory_summaries
    WHERE thread_id = ?
    ORDER BY created DESC
    LIMIT ?
  `).all(threadId, limit).reverse();
}

export function clearSummaries(threadId) {
  db.prepare('DELETE FROM memory_summaries WHERE thread_id = ?').run(threadId);
}

// ─── Active Messages (Non-Archived STM) ─────────────────────────────────

export function getActiveMessages(threadId, limit = 20) {
  return db.prepare(`
    SELECT id, uid, role, content, tokens, timestamp
    FROM messages
    WHERE thread_id = ? AND archived = 0
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(threadId, limit).reverse();
}

export function archiveMessages(threadId, beforeTimestamp) {
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
  return row.count;
}

// ─── Clear All Memory for a Thread ──────────────────────────────────────

export function clearThreadMemory(threadId) {
  db.prepare('DELETE FROM messages WHERE thread_id = ?').run(threadId);
  db.prepare('DELETE FROM memory_summaries WHERE thread_id = ?').run(threadId);
}
