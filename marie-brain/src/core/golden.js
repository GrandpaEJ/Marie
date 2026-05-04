import fs from 'fs';
import path from 'path';
import { vcs } from '../utils/vcs.js';
import { atomicWriteJSON } from '../utils/atomic-write.js';

/**
 * GoldenStateManager manages "Golden States" — stable versions of the bot.
 */
class GoldenStateManager {
  constructor() {
    this.root = process.cwd();
    this.goldenPath = path.join(this.root, 'data', 'golden_state.json');
  }

  /**
   * Saves current state as a Golden State.
   */
  async promoteToGolden(reason = 'System stability milestone') {
    const checkpoint = vcs.checkpoint(`golden: ${reason}`);
    if (checkpoint.success) {
      const state = {
        id: checkpoint.id,
        timestamp: Date.now(),
        reason,
        version: vcs.getCurrentVersion()
      };
      
      atomicWriteJSON(this.goldenPath, state);
      console.log(`[GoldenState] New Golden State established: ${checkpoint.id}`);
      return state;
    }
    return null;
  }

  /**
   * Returns the last Golden State.
   */
  getGoldenState() {
    if (fs.existsSync(this.goldenPath)) {
      return JSON.parse(fs.readFileSync(this.goldenPath, 'utf8'));
    }
    return null;
  }

  /**
   * Performs an emergency rollback to the Golden State.
   */
  async emergencyRollback() {
    const golden = this.getGoldenState();
    if (!golden) throw new Error('No Golden State found to rollback to.');
    
    console.warn(`[GoldenState] EMERGENCY ROLLBACK initiated to ${golden.id}...`);
    return vcs.rollback(golden.id);
  }
}

export const goldenManager = new GoldenStateManager();
