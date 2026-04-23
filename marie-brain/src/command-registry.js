import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Universal Command Registry.
 * Handles loading and matching commands from a specified directory.
 */
export class CommandRegistry {
  constructor(prefix = '.') {
    this.prefix = prefix;
    this.commands = new Map();
    this.aliases = new Map();
  }

  /**
   * Loads all command files from a directory.
   * @param {string} commandsDir - Absolute path to the commands directory
   */
  async loadCommands(commandsDir) {
    if (!fs.existsSync(commandsDir)) {
      console.warn(`[CommandRegistry] Directory not found: ${commandsDir}`);
      return;
    }

    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      // Use pathToFileURL for Windows compatibility and ESM compliance
      const filePath = path.join(commandsDir, file);
      const { default: command } = await import(pathToFileURL(filePath).href);
      
      if (command && command.name) {
        this.commands.set(command.name.toLowerCase(), command);
        if (command.aliases) {
          for (const alias of command.aliases) {
            this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
          }
        }
      }
    }
    console.log(`[CommandRegistry] Loaded ${this.commands.size} commands from ${commandsDir}`);
  }

  /**
   * Matches a text input against registered commands.
   * @param {string} text - The user input
   * @returns {Object|null} { command, args, fullBody }
   */
  findCommand(text) {
    if (!text || !text.startsWith(this.prefix)) return null;

    const body = text.slice(this.prefix.length).trim();
    if (!body) return null;

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
