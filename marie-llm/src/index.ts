import { execFileSync } from 'child_process';
import path from 'path';

export * from './client.js';

/**
 * Native Tokenizer Wrapper for Go tiktoken
 */
export const countTokens = (text: string): number => {
  try {
    const _base = process.cwd();
    const _arch = process.arch;
    const _sub = _base.endsWith('app') ? '..' : '.';
    const binPath = path.resolve(_base, _sub, 'bin', _arch, 'llm');
    
    const stdout = execFileSync(binPath, ['tokenize', text || ''], { encoding: 'utf8' });
    return parseInt(stdout.trim(), 10) || 0;
  } catch (error) {
    // Fallback if binary fails
    return Math.ceil((text || '').length / 4);
  }
};
