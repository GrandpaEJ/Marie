import fs from 'fs';
import path from 'path';
import { atomicWrite } from './atomic-write.js';

/**
 * SafeFS provides a restricted filesystem interface for tools.
 */
class SafeFS {
  constructor() {
    this.root = process.cwd();
    this.allowedWriteDirs = [
      'marie-skills/tools/dynamic',
      'data',
      'temp'
    ];
    this.allowedReadDirs = [
      'marie-brain/src',
      'marie-mem/src',
      'marie-skills',
      'app',
      'data',
      'temp'
    ];
    this.blockedPaths = [
      '.env',
      '.git',
      'node_modules',
      'bin'
    ];
  }

  /**
   * Validates if a path is within allowed directories and not blocked.
   */
  validatePath(filePath, type = 'read') {
    const absolutePath = path.resolve(this.root, filePath);
    
    // 1. Must be within project root
    if (!absolutePath.startsWith(this.root)) {
      throw new Error(`Security Violation: Path "${filePath}" is outside the project root.`);
    }

    const relativePath = path.relative(this.root, absolutePath);

    // 2. Blocked paths check
    if (this.blockedPaths.some(bp => relativePath.startsWith(bp) || relativePath.includes('/' + bp))) {
      throw new Error(`Security Violation: Access to "${filePath}" is blocked.`);
    }

    // 3. Directory allowance check
    const allowedList = type === 'write' ? this.allowedWriteDirs : this.allowedReadDirs;
    const isAllowed = allowedList.some(ad => relativePath.startsWith(ad));

    if (!isAllowed) {
      throw new Error(`Security Violation: ${type.toUpperCase()} access to "${filePath}" is not permitted.`);
    }

    return absolutePath;
  }

  safeRead(filePath) {
    const validated = this.validatePath(filePath, 'read');
    return fs.readFileSync(validated, 'utf-8');
  }

  safeWrite(filePath, content) {
    const validated = this.validatePath(filePath, 'write');
    return atomicWrite(validated, content);
  }
}

export const safeFS = new SafeFS();
