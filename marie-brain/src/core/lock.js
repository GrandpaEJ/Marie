/**
 * Simple Async Lock to prevent concurrent execution of exclusive tools.
 */
class AsyncLock {
  constructor() {
    this.locks = new Map();
  }

  /**
   * Acquires a lock for a given key.
   */
  async acquire(key, timeoutMs = 30000) {
    if (!this.locks.has(key)) {
      this.locks.set(key, Promise.resolve());
    }

    const currentLock = this.locks.get(key);
    let resolveNext;
    const nextLock = new Promise(res => { resolveNext = res; });
    
    this.locks.set(key, nextLock);

    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Lock timeout for ${key}`)), timeoutMs)
    );

    try {
      await Promise.race([currentLock, timeout]);
      return () => { resolveNext(); };
    } catch (err) {
      // Cleanup on timeout
      resolveNext();
      throw err;
    }
  }

  /**
   * Executes a function within a lock.
   */
  async withLock(key, fn) {
    const release = await this.acquire(key);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export const lock = new AsyncLock();
