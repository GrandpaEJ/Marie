/**
 * In-memory buffer for the most recent messages.
 * Provides fast access and prevents excessive database reads.
 */
class ActiveBuffer {
  constructor() {
    this.buffer = new Map(); // threadId -> Message[]
    this.maxCapacity = 30;
    this.pinned = new Set(); // messageID
  }

  /**
   * Push a message into the buffer for a thread.
   */
  push(threadId, msg) {
    if (!this.buffer.has(threadId)) {
      this.buffer.set(threadId, []);
    }

    const threadBuffer = this.buffer.get(threadId);
    
    // Check if message already exists
    if (msg.messageID && threadBuffer.some(m => m.messageID === msg.messageID)) {
      return;
    }

    // Importance heuristic
    if (this._isImportant(msg)) {
      msg.important = true;
    }

    threadBuffer.push(msg);

    // Eviction logic
    if (threadBuffer.length > this.maxCapacity) {
      this._evict(threadId);
    }
  }

  /**
   * Get recent messages from the buffer.
   */
  getRecent(threadId, limit = 30) {
    const threadBuffer = this.buffer.get(threadId) || [];
    return threadBuffer.slice(-limit);
  }

  /**
   * Pin a message to prevent eviction.
   */
  pinMessage(messageID) {
    this.pinned.add(messageID);
  }

  /**
   * Clear buffer for a thread.
   */
  clearThread(threadId) {
    this.buffer.delete(threadId);
  }

  /**
   * Estimate token count for a thread's buffer.
   */
  getTokenCount(threadId) {
    const threadBuffer = this.buffer.get(threadId) || [];
    return threadBuffer.reduce((sum, msg) => sum + (msg.tokens || Math.ceil((msg.content || '').length / 4)), 0);
  }

  /**
   * Internal importance heuristic.
   */
  _isImportant(msg) {
    const content = (msg.content || '').toLowerCase();
    const markers = ["remember", "my name is", "i am", "don't forget", "dont forget"];
    return markers.some(m => content.includes(m));
  }

  /**
   * Evict messages while respecting importance and pinning.
   */
  _evict(threadId) {
    const threadBuffer = this.buffer.get(threadId);
    if (!threadBuffer) return;

    // Find indices that are NOT pinned and NOT important
    let evictIdx = threadBuffer.findIndex(m => !this.pinned.has(m.messageID) && !m.important);

    // If all are important/pinned, try just non-pinned
    if (evictIdx === -1) {
      evictIdx = threadBuffer.findIndex(m => !this.pinned.has(m.messageID));
    }

    // If still -1, just take the first one (everything is pinned? unlikely but possible)
    if (evictIdx === -1) {
      evictIdx = 0;
    }

    threadBuffer.splice(evictIdx, 1);
  }
}

export const activeBuffer = new ActiveBuffer();
