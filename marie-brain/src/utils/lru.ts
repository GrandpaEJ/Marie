/**
 * A lightweight, dependency-free LRU cache using a native Map.
 */
export class SimpleLRU<K, V> {
    private cache: Map<K, V>;
    private max: number;

    constructor(options: { max: number }) {
        this.cache = new Map<K, V>();
        this.max = options.max;
    }

    get(key: K): V | undefined {
        const item = this.cache.get(key);
        if (item !== undefined) {
            // Refresh key position (move to most recent)
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.max) {
            // Evict oldest (first key in insertion order)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}
