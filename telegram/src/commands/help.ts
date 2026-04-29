import { IMarieContext } from '@marie/brain';

export default {
  name: 'help',
  description: 'Aesthetic & Category-wise Help Guide',
  handler: async (ctx: IMarieContext) => {
    const { registry, config, args } = ctx;
    const prefix = config.prefix || '.';
    const botName = config.botName || "Marie";
    const commandArg = (args[0] || "").toLowerCase();

    // 1. Get and filter commands
    const allCommands = Array.from(registry.commands.values());
    const filteredCommands = new Map();
    const seen = new Set();

    for (const cmd of allCommands as any[]) {
      if (seen.has(cmd)) continue;
      seen.add(cmd);
      if (!cmd.hidden) {
        filteredCommands.set(cmd.name.toLowerCase(), cmd);
      }
    }

    // ─── CASE 1: COMMAND DETAILS ───
    if (commandArg && filteredCommands.has(commandArg)) {
      const command = filteredCommands.get(commandArg);
      let info = `╭━━━[ *${command.name.toUpperCase()}* ]━━━╮\n`;
      info += `📝 *Description:* ${command.description || "No description available"}\n`;
      info += `🏷️ *Category:* ${command.category || command.commandCategory || "General"}\n`;
      info += `⏱️ *Cooldown:* ${command.cooldown || 0}s\n`;
      info += `📖 *Usage:* \`${prefix}${command.name} ${command.usage || ""}\`\n`;
      info += `╰━━━━━━━━━━╯`;
      return ctx.reply(info);
    }

    // ─── CASE 2: CATEGORY LISTING ───
    const commandList = Array.from(filteredCommands.values());
    const categories: Record<string, string[]> = {};

    commandList.forEach((cmd) => {
      const cat = cmd.category || cmd.commandCategory || "General";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd.name);
    });

    const sortedCategories = Object.keys(categories).sort();
    const numberFont = ["❶","❷","❸","❹","❺","❻","❼","❽","❾","❿"];

    let helpMsg = `╔═══════════════╗\n`;
    helpMsg += `   🏠 *${botName.toUpperCase()} HELP GUIDE*  \n`;
    helpMsg += `╚═══════════════╝\n\n`;

    sortedCategories.forEach((cat, i) => {
      const catCmds = categories[cat].sort();
      helpMsg += `╭─── 〔 ${numberFont[i] || (i+1)} *${cat.toUpperCase()}* 〕\n`;
      
      // Grid style for commands
      const grid = 2;
      for (let j = 0; j < catCmds.length; j += grid) {
        const row = catCmds.slice(j, j + grid);
        helpMsg += `│ ◗ \`${row.map(n => prefix + n).join('`  `')}\` \n`;
      }
      helpMsg += `╰───\n`;
    });

    helpMsg += `\n💡 Type \`${prefix}help [name]\` for details.\n`;
    helpMsg += `◖ Total: *${filteredCommands.size}* commands ◗`;

    await ctx.reply(helpMsg);
  }
};
