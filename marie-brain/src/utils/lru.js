/**
 * A lightweight, dependency-free LRU cache using a native Map.
 */
export class SimpleLRU {
    cache;
    max;
    constructor(options) {
        this.cache = new Map();
        this.max = options.max;
    }
    get(key) {
        const item = this.cache.get(key);
        if (item !== undefined) {
            // Refresh key position (move to most recent)
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }
    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        else if (this.cache.size >= this.max) {
            // Evict oldest (first key in insertion order)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, value);
    }
    has(key) {
        return this.cache.has(key);
    }
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
}
