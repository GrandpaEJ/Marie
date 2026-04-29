import fs from 'fs';
/**
 * Provides a safe version of fs that prevents crashes on common errors.
 */
export declare const safeFs: typeof fs;
/**
 * Global mocks for legacy bot compatibility.
 */
export declare function initGlobalMocks(config?: {
    prefix?: string;
    admins?: string[];
    owner?: string;
}): void;
