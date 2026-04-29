import fg from 'fast-glob';
export class CommandRegistry {
    prefix;
    commands = new Map();
    constructor(prefix = '.') {
        this.prefix = prefix;
    }
    register(command) {
        this.commands.set(command.name.toLowerCase(), command);
        if (command.aliases) {
            for (const alias of command.aliases) {
                this.commands.set(alias.toLowerCase(), command);
            }
        }
    }
    async loadCommands(dirPath, wrapper) {
        const files = await fg('**/*.js', { cwd: dirPath, absolute: true });
        for (const file of files) {
            try {
                const module = await import(`file://${file}`);
                const rawCommand = module.default || module;
                const finalCommand = wrapper ? wrapper(rawCommand) : rawCommand;
                if (finalCommand && finalCommand.name && finalCommand.handler) {
                    this.register(finalCommand);
                }
            }
            catch (error) {
                console.error(`[CommandRegistry] Failed to load command from ${file}:`, error);
            }
        }
    }
    findCommand(text) {
        if (!text || !text.startsWith(this.prefix))
            return null;
        const body = text.slice(this.prefix.length).trim();
        if (!body)
            return null;
        const args = body.split(/\s+/);
        const name = args.shift()?.toLowerCase();
        if (!name)
            return null;
        const command = this.commands.get(name);
        if (command)
            return { command, args };
        return null;
    }
}
