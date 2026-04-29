import { getStats, getGlobalStats } from '../storage/thread-store.js';

export default {
  name: 'tokenstats',
  aliases: ['stats'],
  description: 'View token usage analytics',
  commandCategory: 'system',
  usage: '.tokenstats [global]',
  minRole: 'user',
  handler: async (ctx) => {
    const { api, event, args, user } = ctx;
    const { threadID } = event;

    if (args[0] === 'global') {
      if (user.role !== 'owner' && user.role !== 'admin') {
        return api.sendMessage("[Marie] Permission denied. Admin required for global stats.", threadID);
      }
      const stats = getGlobalStats();
      let msg = `[ Marie Global Stats ]\n\n`;
      msg += `Input Tokens: ${stats.total_input?.toLocaleString() || 0}\n`;
      msg += `Output Tokens: ${stats.total_output?.toLocaleString() || 0}\n`;
      msg += `Total Cost: $${(stats.total_cost || 0).toFixed(4)}`;
      return api.sendMessage(msg, threadID);
    }

    const stats = getStats(threadID);
    let msg = `[ Marie Thread Stats ]\n\n`;
    msg += `Input Tokens: ${stats.total_input?.toLocaleString() || 0}\n`;
    msg += `Output Tokens: ${stats.total_output?.toLocaleString() || 0}\n`;
    msg += `Total Cost: $${(stats.total_cost || 0).toFixed(4)}`;
    api.sendMessage(msg, threadID);
  }
};
