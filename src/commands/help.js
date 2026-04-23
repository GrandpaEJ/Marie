import { hasPermission } from '../storage/user-store.js';

export default {
  name: 'help',
  description: 'Show available commands',
  usage: '.help [command]',
  minRole: 'user',
  handler: async (ctx) => {
    const { api, event, args, user, config } = ctx;
    const { threadID } = event;

    // This needs access to the registry. 
    // In brain.js, I pass the whole ctx which includes the registry if I add it.
    // Wait, I didn't add registry to ctx in brain.js. I should fix that.
    
    // For now, let's assume we'll fix brain.js to include 'registry' in ctx.
    const registry = ctx.registry;
    if (!registry) {
       return api.sendMessage("[Marie] Error: Command registry not found in context.", threadID);
    }

    if (args[0]) {
      const cmdName = registry.aliases.get(args[0].toLowerCase()) || args[0].toLowerCase();
      const cmd = registry.commands.get(cmdName);
      if (cmd) {
        let helpText = `[ Marie Command Help ]\n`;
        helpText += `Name: ${cmd.name}\n`;
        if (cmd.aliases) helpText += `Aliases: ${cmd.aliases.join(', ')}\n`;
        helpText += `Description: ${cmd.description || 'No description'}\n`;
        helpText += `Usage: ${cmd.usage || config.prefix + cmd.name}\n`;
        helpText += `Min Role: ${cmd.minRole || 'user'}`;
        return api.sendMessage(helpText, threadID);
      }
    }

    let msg = `[ Marie Commands ]\n`;
    msg += `Prefix: ${config.prefix}\n\n`;

    const visibleCommands = [];
    for (const cmd of registry.commands.values()) {
      if (!cmd.minRole || hasPermission(user.role, cmd.minRole)) {
        visibleCommands.push(`${config.prefix}${cmd.name} - ${cmd.description || ''}`);
      }
    }

    msg += visibleCommands.join('\n');
    msg += `\n\nUse .help <command> for details.`;

    api.sendMessage(msg, threadID);
  }
};
