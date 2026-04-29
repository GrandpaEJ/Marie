import fs from 'fs';
import path from 'path';
/**
 * Provides a safe version of fs that prevents crashes on common errors.
 */
export const safeFs = new Proxy(fs, {
    get(target, prop) {
        const original = target[prop];
        if (typeof original === 'function') {
            return (...args) => {
                try {
                    return original(...args);
                }
                catch (error) {
                    console.error(`[FS-Fallback] Error in fs.${String(prop)}:`, error);
                    return null;
                }
            };
        }
        return original;
    }
});
/**
 * Global mocks for legacy bot compatibility.
 */
export function initGlobalMocks() {
    const g = global;
    if (!g.fs)
        g.fs = safeFs;
    if (!g.path)
        g.path = path;
    // Mock common dependencies if not present
    if (!g.axios) {
        g.axios = {
            get: async () => ({ data: {} }),
            post: async () => ({ data: {} })
        };
    }
    // Ensure client/data exist for Mirai
    if (!g.client) {
        g.client = {
            commands: new Map(),
            events: new Map(),
            aliases: new Map(),
            cooldowns: new Map(),
            mainPath: process.cwd(),
            configPath: "",
            getTime: () => Date.now()
        };
    }
    if (!g.data) {
        g.data = {
            threadData: new Map(),
            threadInfo: new Map(),
            userName: new Map(),
            userBanned: new Map(),
            threadBanned: new Map(),
            commandBanned: new Map(),
            threadAllowNSFW: [],
            allUserID: [],
            allCurrenciesID: [],
            allThreadID: []
        };
    }
}
