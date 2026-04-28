import { hasPermission } from '../storage/user-store.js';

export default {
  name: 'help',
  version: '2.1.0',
  credits: 'Grandpa Academy',
  description: 'Dynamic & Aesthetic Help Guide',
  commandCategory: 'system',
  usage: '.help [page/command]',
  cooldown: 5,
  minRole: 'user',
  handler: async (ctx) => {
    const { api, event, args, user, config, registry } = ctx;
    const { threadID, senderID, messageID } = event;

    const prefix = config.prefix || ".";
    const botName = config.botName || "Marie";
    const admins = config.admins || [];
    const commandArg = (args[0] || "").toLowerCase();

    // 1. Filter commands based on user permission
    const filteredCommands = new Map();
    const seen = new Set();
    
    // Sort commands alphabetically
    const allCommands = Array.from(registry.commands.values());
    
    for (const cmd of allCommands) {
      if (seen.has(cmd)) continue;
      seen.add(cmd);

      // Map roles to numeric levels for comparison if needed, but hasPermission handles strings
      if (!cmd.minRole || hasPermission(user.role, cmd.minRole)) {
        filteredCommands.set(cmd.name.toLowerCase(), cmd);
      }
    }

    // ─── COMMAND DETAILS ───
    if (commandArg && filteredCommands.has(commandArg)) {
      const command = filteredCommands.get(commandArg);
      const raw = command.rawModule || {};
      const cmdConfig = raw.config || command.config || command;
      
      // Determine Command Type
      let type = "Native";
      if (raw.run && raw.config && (raw.config.hasPermssion !== undefined || raw.config.commandCategory)) type = "Mirai";
      else if (raw.onStart && raw.config) type = "Goat";

      let info = `╭━━━[ ${command.name.toUpperCase()} ]━━━╮\n`;
      info += `📝 Description: ${cmdConfig.description || "No description available"}\n`;
      info += `🏷️  Category: ${cmdConfig.commandCategory || cmdConfig.category || "General"}\n`;
      info += `⏱️  Cooldown: ${cmdConfig.cooldowns || cmdConfig.countDown || cmdConfig.cooldown || 0}s\n`;
      info += `🔒 Permission: ${command.minRole || "user"} (Level ${cmdConfig.hasPermssion ?? cmdConfig.role ?? 0})\n`;
      info += `📖 Usage: ${prefix}${command.name} ${cmdConfig.usages || cmdConfig.usage || (typeof cmdConfig.guide === 'string' ? cmdConfig.guide : cmdConfig.guide?.en) || ""}\n`;
      info += `👤 Credits: ${cmdConfig.credits || cmdConfig.author || "Unknown"}\n`;
      info += `🛠️  Type: ${type}\n`;
      info += `╰━━━━━━━━━━╯`;
      return ctx.reply(info.replace(/\{pn\}/g, prefix));
    }

    // ─── CATEGORY LISTING (PAGINATED) ───
    const commandList = Array.from(filteredCommands.values());
    const categories = Array.from(new Set(commandList.map((cmd) => {
      const cmdConfig = cmd.rawModule?.config || cmd.config || cmd;
      return cmdConfig.commandCategory || cmdConfig.category || "General";
    }))).sort();
    
    const itemsPerPage = 8;
    const totalPages = Math.ceil(categories.length / itemsPerPage);
    let currentPage = 1;

    if (commandArg && !isNaN(parseInt(commandArg))) {
      const parsedPage = parseInt(commandArg);
      if (parsedPage >= 1 && parsedPage <= totalPages) {
        currentPage = parsedPage;
      }
    }

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const visibleCategories = categories.slice(startIdx, endIdx);
    
    const numberFont = ["❶","❷","❸","❹","❺","❻","❼","❽","❾","❿"];
    const numberFontPage = ["➀","➁","➂","➃","➄","➅","➆","➇","➈","➉"];

    let helpMsg = `╔═══════════════╗\n`;
    helpMsg += `║   🏠 ${botName.toUpperCase()} HELP GUIDE  ║\n`;
    helpMsg += `╚═══════════════╝\n\n`;

    for (let i = 0; i < visibleCategories.length; i++) {
      const cat = visibleCategories[i];
      const catCmds = commandList
        .filter((cmd) => {
          const cmdConfig = cmd.rawModule?.config || cmd.config || cmd;
          return (cmdConfig.commandCategory || cmdConfig.category || "General") === cat;
        })
        .map((cmd) => cmd.name)
        .sort();
      
      helpMsg += `╭─── 〔 ${numberFont[i] || (i+1)} ${cat.toUpperCase()} 〕\n`;
      
      const grid = config.helpGrid || 2;
      for (let j = 0; j < catCmds.length; j += grid) {
        const row = catCmds.slice(j, j + grid);
        helpMsg += `│ ◗ ✿︎ ${row.join(" ✿︎ ")}\n`;
      }
      helpMsg += `╰───\n`;
    }

    helpMsg += `╭ ──────── ╮\n`;
    helpMsg += `│ Page ${numberFontPage[currentPage - 1] || currentPage} of ${numberFontPage[totalPages - 1] || totalPages} │\n`;
    helpMsg += `╰ ──────── ╯\n`;
    helpMsg += `◖Total: ${filteredCommands.size} commands | ${categories.length} categories◗\n\n`;
    
    helpMsg += `💡 Type "${prefix}help [name]" for details.\n`;
    helpMsg += `💡 Type "${prefix}help [page]" for more pages.\n`;
    helpMsg += `👤 Owner: fb.com/${admins[0] || "Unknown"}`;

    return ctx.reply(helpMsg);
  }
};
