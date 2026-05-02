import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export * from './client.js';
/**
 * Native Tokenizer Wrapper for Go tiktoken
 */
export const countTokens = (text) => {
    try {
        // Navigate from marie-brain/dist/llm/index.js up to the project root
        const binPath = path.resolve(__dirname, '../../../../bin/llm');
        const stdout = execFileSync(binPath, ['tokenize', text || ''], { encoding: 'utf8' });
        return parseInt(stdout.trim(), 10) || 0;
    }
    catch (error) {
        // Fallback if binary fails
        return Math.ceil((text || '').length / 4);
    }
};
