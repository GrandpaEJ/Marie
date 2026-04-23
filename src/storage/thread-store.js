import db from './db.js';

export function getThread(threadId) {
  let thread = db.prepare('SELECT * FROM threads WHERE thread_id = ?').get(threadId);
  if (!thread) {
    // Create default thread config
    db.prepare(`
      INSERT INTO threads (thread_id, created, updated)
      VALUES (?, unixepoch(), unixepoch())
    `).run(threadId);
    thread = db.prepare('SELECT * FROM threads WHERE thread_id = ?').get(threadId);
  }
  return thread;
}

export function updateThread(threadId, updates) {
  const keys = Object.keys(updates);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  
  db.prepare(`
    UPDATE threads
    SET ${setClause}, updated = unixepoch()
    WHERE thread_id = ?
  `).run(...values, threadId);
}

export function addMessage(threadId, role, content, tokens = 0) {
  db.prepare(`
    INSERT INTO messages (thread_id, role, content, tokens, timestamp)
    VALUES (?, ?, ?, ?, unixepoch())
  `).run(threadId, role, content, tokens);
}

export function getHistory(threadId, limit = 50) {
  return db.prepare(`
    SELECT role, content, tokens, timestamp
    FROM messages
    WHERE thread_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(threadId, limit).reverse();
}

export function clearHistory(threadId) {
  db.prepare('DELETE FROM messages WHERE thread_id = ?').run(threadId);
}

export function logUsage(threadId, uid, model, inputTokens, outputTokens, cost = 0) {
  db.prepare(`
    INSERT INTO token_usage (thread_id, uid, model, input_tokens, output_tokens, cost_usd, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).run(threadId, uid, model, inputTokens, outputTokens, cost);
}

export function getStats(threadId) {
  return db.prepare(`
    SELECT 
      SUM(input_tokens) as total_input,
      SUM(output_tokens) as total_output,
      SUM(cost_usd) as total_cost
    FROM token_usage
    WHERE thread_id = ?
  `).get(threadId);
}

export function getGlobalStats() {
  return db.prepare(`
    SELECT 
      SUM(input_tokens) as total_input,
      SUM(output_tokens) as total_output,
      SUM(cost_usd) as total_cost
    FROM token_usage
  `).get();
}
