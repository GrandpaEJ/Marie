import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * VCSBridge handles version control operations using Git when available,
 * or a custom checkpoint system as a fallback.
 */
class VCSBridge {
  constructor() {
    this.root = process.cwd();
    this.backend = this.isGitAvailable() ? 'git' : 'custom';
    this.checkpointDir = path.join(this.root, 'data', 'backups', 'checkpoints');
    
    if (this.backend === 'custom' && !fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * Checks if Git is available and initialized.
   */
  isGitAvailable() {
    try {
      // Check for .git directory
      if (!fs.existsSync(path.join(this.root, '.git'))) return false;
      
      // Check if git command works
      execSync('git --version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Returns current version or short hash.
   */
  getCurrentVersion() {
    if (this.backend === 'git') {
      try {
        return execSync('git describe --tags --always', { encoding: 'utf-8' }).trim();
      } catch (e) {
        return 'unknown-git';
      }
    } else {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(this.root, 'package.json'), 'utf-8'));
        return pkg.version || '0.0.0';
      } catch (e) {
        return '0.0.0';
      }
    }
  }

  /**
   * Returns short commit hash or custom state hash.
   */
  getCurrentHash() {
    if (this.backend === 'git') {
      try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
      } catch (e) {
        return '0000000';
      }
    } else {
      // Custom hash: based on package.json and mtimes of src files
      const pkgContent = fs.readFileSync(path.join(this.root, 'package.json'), 'utf-8');
      const hash = crypto.createHash('sha256').update(pkgContent);
      
      // We'll just hash the package.json for now as a placeholder for custom backend
      return hash.digest('hex').substring(0, 7);
    }
  }

  /**
   * Lists all available checkpoints.
   */
  listCheckpoints() {
    if (this.backend === 'git') {
      try {
        const output = execSync('git tag -l "checkpoint/*" --sort=-creatordate', { encoding: 'utf-8' });
        return output.split('\n').filter(t => !!t).map(tag => {
          const timestamp = parseInt(tag.split('/')[1]);
          return { id: tag, timestamp, date: new Date(timestamp).toISOString() };
        });
      } catch (e) {
        return [];
      }
    } else {
      try {
        if (!fs.existsSync(this.checkpointDir)) return [];
        return fs.readdirSync(this.checkpointDir)
          .filter(d => /^\d+$/.test(d))
          .map(d => {
            const timestamp = parseInt(d);
            return { id: d, timestamp, date: new Date(timestamp).toISOString() };
          })
          .sort((a, b) => b.timestamp - a.timestamp);
      } catch (e) {
        return [];
      }
    }
  }

  /**
   * Creates a checkpoint.
   */
  checkpoint(reason) {
    const timestamp = Date.now();
    const isoDate = new Date().toISOString();
    
    if (this.backend === 'git') {
      try {
        execSync('git add -A', { cwd: this.root });
        const status = execSync('git status --porcelain', { cwd: this.root, encoding: 'utf-8' });
        if (status) {
          execSync(`git commit -m "🤖 Marie Checkpoint: ${reason} — ${isoDate}"`, { cwd: this.root });
          const tagName = `checkpoint/${timestamp}`;
          execSync(`git tag ${tagName}`, { cwd: this.root });
          return { success: true, backend: 'git', id: tagName };
        }
        return { success: true, backend: 'git', message: 'No changes to checkpoint' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } else {
      try {
        const dest = path.join(this.checkpointDir, timestamp.toString());
        fs.mkdirSync(dest, { recursive: true });
        
        // Custom mode: Copy src files (placeholder list)
        const dirsToBackup = ['marie-brain', 'marie-skills', 'marie-mem', 'app'];
        for (const dir of dirsToBackup) {
          const srcPath = path.join(this.root, dir);
          if (fs.existsSync(srcPath)) {
            fs.cpSync(srcPath, path.join(dest, dir), { recursive: true });
          }
        }
        
        fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({
          timestamp,
          reason,
          isoDate
        }, null, 2));

        return { success: true, backend: 'custom', id: timestamp.toString() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }

  /**
   * Rollback to a specific checkpoint.
   */
  rollback(id) {
    if (this.backend === 'git') {
      try {
        this.checkpoint(`pre-rollback-to-${id}`);
        execSync(`git checkout ${id} -- .`, { cwd: this.root });
        execSync(`git commit -m "🤖 Marie Rollback to ${id}"`, { cwd: this.root });
        return { success: true, id };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } else {
      try {
        const src = path.join(this.checkpointDir, id.toString());
        if (!fs.existsSync(src)) return { success: false, error: 'Checkpoint not found' };

        // Save current as safety
        this.checkpoint(`pre-rollback-to-${id}`);

        const dirsToRestore = ['marie-brain', 'marie-skills', 'marie-mem', 'app'];
        for (const dir of dirsToRestore) {
          const backupPath = path.join(src, dir);
          if (fs.existsSync(backupPath)) {
            fs.cpSync(backupPath, path.join(this.root, dir), { recursive: true });
          }
        }
        return { success: true, id };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }
}

export const vcs = new VCSBridge();
