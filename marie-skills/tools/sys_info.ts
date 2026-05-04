import { z } from 'zod';
import os from 'os';

/**
 * System Info tool. Returns CPU, RAM, and OS stats.
 */
export default {
  name: 'sys_info',
  description: 'Get real-time system performance metrics (CPU, RAM, Uptime).',
  schema: z.object({}),
  parameters: {
    type: 'object',
    properties: {}
  },
  handler: async () => {
    const uptime = os.uptime();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const cpus = os.cpus();
    const load = os.loadavg();

    return {
      success: true,
      platform: os.platform(),
      release: os.release(),
      uptime: {
        seconds: uptime,
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      },
      memory: {
        free: Math.round(freeMem / 1024 / 1024) + ' MB',
        total: Math.round(totalMem / 1024 / 1024) + ' MB',
        usage_percent: Math.round((1 - freeMem / totalMem) * 100) + '%'
      },
      cpu: {
        model: cpus[0].model,
        count: cpus.length,
        load_avg: load
      }
    };
  }
};
