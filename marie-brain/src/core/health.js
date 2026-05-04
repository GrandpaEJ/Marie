import { vcs } from '../utils/vcs.js';

/**
 * HealthMonitor tracks system stability and triggers automated maintenance.
 */
class HealthMonitor {
  constructor() {
    this.successCount = 0;
    this.errorCount = 0;
    this.lastCheckpointTime = Date.now();
    this.stabilityThreshold = 50; // Checkpoint every 50 successful messages
  }

  /**
   * Log a successful message handling.
   */
  logSuccess() {
    this.successCount++;
    
    // Auto-checkpoint if stable
    if (this.successCount % this.stabilityThreshold === 0) {
      const isGoldenMilestone = this.successCount % (this.stabilityThreshold * 2) === 0;
      
      if (isGoldenMilestone) {
        console.log(`[Health] Reached Golden stability milestone (${this.successCount} successes). Promoting to Golden State...`);
        import('./golden.js').then(m => m.goldenManager.promoteToGolden(`stability milestone ${this.successCount}`));
      } else {
        console.log(`[Health] Reached stability milestone (${this.successCount} successes). Auto-checkpointing...`);
        vcs.checkpoint(`auto: stability milestone ${this.successCount}`);
      }
      this.lastCheckpointTime = Date.now();
    }
  }

  /**
   * Log an error.
   */
  logError() {
    this.errorCount++;
    // Future: Auto-rollback if error rate is too high
  }

  /**
   * Get current health status string.
   */
  getStatus() {
    const total = this.successCount + this.errorCount;
    const rate = total === 0 ? 100 : Math.round((this.successCount / total) * 100);
    const lastCheck = Math.round((Date.now() - this.lastCheckpointTime) / 60000);

    return `[Health] Status: ${rate > 90 ? 'Stable' : 'Volatile'} (${rate}%) | Successes: ${this.successCount} | Last checkpoint: ${lastCheck}m ago`;
  }
}

export const health = new HealthMonitor();
