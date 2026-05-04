import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

/**
 * Self-Restart tool. Allows Marie to gracefully exit and be restarted by a watchdog.
 */
export default {
  name: 'self_restart',
  description: 'Gracefully restart the Marie process. Use after code upgrades or to clear state.',
  category: 'system',
  riskLevel: 'critical',
  schema: z.object({
    reason: z.string().describe('The reason for restarting')
  }),
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string' }
    },
    required: ['reason']
  },
  handler: async ({ reason }: any, context: any) => {
    const restartStatePath = path.join(process.cwd(), 'data', 'restart_state.json');
    
    const state = {
      timestamp: Date.now(),
      reason,
      threadID: context.threadID,
      senderID: context.senderID
    };

    try {
      // 1. Ensure data dir exists
      await fs.mkdir(path.dirname(restartStatePath), { recursive: true });
      
      // 2. Save restart context
      await fs.writeFile(restartStatePath, JSON.stringify(state, null, 2));

      // 3. Inform the user (this will be sent by the platform before process exits)
      console.log(`[SelfRestart] Triggered by ${context.senderID}. Reason: ${reason}`);
      
      // 4. Trigger exit after a short delay
      setTimeout(() => {
        console.log('[SelfRestart] Exiting process...');
        process.exit(0);
      }, 1000);

      return { success: true, message: `Restarting Marie... Reason: ${reason}` };
    } catch (error: any) {
      return { success: false, error: `Failed to initiate restart: ${error.message}` };
    }
  }
};
