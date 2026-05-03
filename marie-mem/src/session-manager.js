/**
 * Manages conversation sessions. 
 * A session is considered ended if no messages are sent for 30 minutes.
 */
class SessionManager {
  constructor(db) {
    this.db = db;
    this.timeoutMinutes = 30;
  }

  init(database) {
    this.db = database;
  }

  /**
   * Get current active session or create a new one.
   * @returns {Object} { session, isNew }
   */
  getOrCreateSession(threadId) {
    const now = Math.floor(Date.now() / 1000);
    const timeoutSeconds = this.timeoutMinutes * 60;

    // Try to find an active session
    let session = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE thread_id = ? AND is_active = 1
      ORDER BY last_active DESC LIMIT 1
    `).get(threadId);

    if (session) {
      // Check for timeout
      if (now - session.last_active > timeoutSeconds) {
        // End old session
        this.endSession(session.id);
        session = null;
      }
    }

    if (!session) {
      // Create new session
      this.db.prepare(`
        INSERT INTO sessions (thread_id, start_time, last_active, is_active)
        VALUES (?, ?, ?, 1)
      `).run(threadId, now, now);

      session = this.db.prepare(`
        SELECT * FROM sessions 
        WHERE thread_id = ? AND is_active = 1
        ORDER BY start_time DESC LIMIT 1
      `).get(threadId);

      return { session, isNew: true };
    }

    return { session, isNew: false };
  }

  /**
   * Update session activity.
   */
  touch(threadId) {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      UPDATE sessions 
      SET last_active = ?, msg_count = msg_count + 1 
      WHERE thread_id = ? AND is_active = 1
    `).run(now, threadId);
  }

  /**
   * Close a specific session.
   */
  endSession(sessionId, summary = null) {
    this.db.prepare(`
      UPDATE sessions 
      SET is_active = 0, summary = ? 
      WHERE id = ?
    `).run(summary, sessionId);
  }

  /**
   * Get the summary of the last closed session for context injection.
   */
  getLastSessionSummary(threadId) {
    const last = this.db.prepare(`
      SELECT summary FROM sessions 
      WHERE thread_id = ? AND is_active = 0 
      ORDER BY last_active DESC LIMIT 1
    `).get(threadId);
    return last?.summary || null;
  }

  /**
   * Temporary metadata for the current session.
   */
  setSessionMetadata(threadId, key, value) {
    const { session } = this.getOrCreateSession(threadId);
    const metadata = JSON.parse(session.metadata || '{}');
    metadata[key] = value;
    this.db.prepare('UPDATE sessions SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), session.id);
  }

  getSessionMetadata(threadId, key) {
    const { session } = this.getOrCreateSession(threadId);
    const metadata = JSON.parse(session.metadata || '{}');
    return key ? metadata[key] : metadata;
  }
}

export const sessionManager = new SessionManager();
