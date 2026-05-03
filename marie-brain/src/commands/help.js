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
            if (seen.has(cmd))
                continue;
            seen.add(cmd);
            // Map roles to numeric levels for comparison if needed, but hasPermission handles strings
            if (!cmd.minRole || hasPermission(user.role, cmd.minRole)) {
                filteredCommands.set(cmd.name.toLowerCase(), cmd);
            }
        }
        // ─── TOOL/SKILL DETAILS ───
        if (commandArg && ctx.skills) {
            const tool = ctx.skills.tools?.get(commandArg);
            if (tool) {
                let info = `╭━━━[ 🛠️ TOOL: ${tool.name.toUpperCase()} ]━━━╮\n`;
                info += `📝 Description: ${tool.detailedDescription || tool.description || "No description available"}\n`;
                info += `🏷️  Category: ${tool.category || "utility"}\n`;
                info += `⚠️  Risk Level: ${tool.riskLevel || "low"}\n`;
                
                if (tool.examples && tool.examples.length > 0) {
                    info += `\n💡 Examples:\n`;
                    tool.examples.forEach(ex => {
                        info += `├─ Input: ${JSON.stringify(ex.input)}\n`;
                        if (ex.explanation) info += `└─ ${ex.explanation}\n`;
                    });
                }
                
                info += `\n╰━━━━━━━━━━━━━━━━╯`;
                return ctx.reply(info);
            }
        }

        // ─── COMMAND DETAILS ───
        if (commandArg && filteredCommands.has(commandArg)) {
            const command = filteredCommands.get(commandArg);
            const raw = command.rawModule || {};
            const cmdConfig = raw.config || command.config || command;
            
            let info = `╭━━━[ 📜 CMD: ${command.name.toUpperCase()} ]━━━╮\n`;
            info += `📝 Description: ${cmdConfig.description || "No description available"}\n`;
            info += `🏷️  Category: ${cmdConfig.commandCategory || cmdConfig.category || "General"}\n`;
            info += `🔒 Permission: ${command.minRole || "user"}\n`;
            info += `📖 Usage: ${prefix}${command.name} ${cmdConfig.usages || cmdConfig.usage || ""}\n`;
            info += `╰━━━━━━━━━━━━━━━━╯`;
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
        const numberFont = ["❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾", "❿"];
        const numberFontPage = ["➀", "➁", "➂", "➃", "➄", "➅", "➆", "➇", "➈", "➉"];
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
            helpMsg += `╭─── 〔 ${numberFont[i] || (i + 1)} ${cat.toUpperCase()} 〕\n`;
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
