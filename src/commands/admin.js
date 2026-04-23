import { updateThread } from '../storage/thread-store.js';
import { setRole } from '../storage/user-store.js';

export default {
  name: 'admin',
  description: 'Bot administration commands',
  usage: '.admin nsfw <on|off> | .admin role <uid> <role>',
  minRole: 'admin',
  handler: async (ctx) => {
    const { api, event, args, user, config } = ctx;
    const { threadID } = event;

    if (!args[0]) return api.sendMessage("[Marie] See .help admin for usage.", threadID);

    const sub = args[0].toLowerCase();

    if (sub === 'nsfw') {
      const mode = args[1]?.toLowerCase();
      if (mode === 'on') {
        updateThread(threadID, { nsfw: 1 });
        return api.sendMessage("[Marie] NSFW content enabled for this thread.", threadID);
      } else if (mode === 'off') {
        updateThread(threadID, { nsfw: 0 });
        return api.sendMessage("[Marie] NSFW content disabled for this thread.", threadID);
      }
      return api.sendMessage("[Marie] Usage: .admin nsfw on|off", threadID);
    }

    if (sub === 'role') {
      if (user.role !== 'owner') return api.sendMessage("[Marie] Only owner can change roles.", threadID);
      const targetUid = args[1];
      const targetRole = args[2]?.toLowerCase();
      
      if (!targetUid || !targetRole) return api.sendMessage("[Marie] Usage: .admin role <uid> <role>", threadID);
      
      try {
        setRole(targetUid, targetRole);
        return api.sendMessage(`[Marie] Role for ${targetUid} updated to ${targetRole}.`, threadID);
      } catch (e) {
        return api.sendMessage(`[Marie] Error: ${e.message}`, threadID);
      }
    }

    if (sub === 'restart') {
      if (user.role !== 'owner') return api.sendMessage("[Marie] Only owner can restart the bot.", threadID);
      await api.sendMessage("[Marie] Restarting...", threadID);
      process.exit(0); // Assuming PM2 or similar will restart
    }
  }
};
