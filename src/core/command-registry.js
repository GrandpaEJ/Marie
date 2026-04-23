import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.join(__dirname, '../commands');

class CommandRegistry {
  constructor(prefix = '.') {
    this.prefix = prefix;
    this.commands = new Map();
    this.aliases = new Map();
  }

  async loadCommands() {
    if (!fs.existsSync(COMMANDS_DIR)) return;

    const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      const { default: command } = await import(path.join(COMMANDS_DIR, file));
      if (command && command.name) {
        this.commands.set(command.name.toLowerCase(), command);
        if (command.aliases) {
          for (const alias of command.aliases) {
            this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
          }
        }
      }
    }
    console.log(`Loaded ${this.commands.size} commands.`);
  }

  findCommand(text) {
    if (!text.startsWith(this.prefix)) return null;

    const body = text.slice(this.prefix.length).trim();
    const parts = body.split(/\s+/);
    const trigger = parts[0].toLowerCase();

    const cmdName = this.aliases.get(trigger) || trigger;
    const command = this.commands.get(cmdName);

    if (command) {
      return {
        command,
        args: parts.slice(1),
        fullBody: body
      };
    }

    return null;
  }
}

export default CommandRegistry;
