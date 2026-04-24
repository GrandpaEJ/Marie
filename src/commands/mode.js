import fs from 'fs';
import path from 'path';

export default {
  name: 'mode',
  description: 'Change the global bot access mode',
  usage: '.mode <owner|admins|all>',
  minRole: 'owner',
  handler: async (ctx) => {
    const { api, event, args, config } = ctx;
    const { threadID } = event;

    if (!args[0]) {
      return api.sendMessage(`[Marie] Current Mode: ${config.mode || 'all'}\nAvailable: owner, admins, all`, threadID);
    }

    const newMode = args[0].toLowerCase();
    const validModes = ['owner', 'admins', 'all'];

    if (!validModes.includes(newMode)) {
      return api.sendMessage(`[Marie] Invalid mode. Use: ${validModes.join(', ')}`, threadID);
    }

    // Update in-memory config
    config.mode = newMode;

    // Persist to config.json
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return api.sendMessage(`[Marie] Global mode updated to: ${newMode}`, threadID);
    } catch (error) {
      return api.sendMessage(`[Marie] Failed to save config: ${error.message}`, threadID);
    }
  }
};
