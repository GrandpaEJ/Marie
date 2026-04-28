import path from 'path';
import fs from 'fs';
import { CommandRegistry } from '../core/command-registry.js';
import { EventRegistry } from '../core/event-registry.js';
import { wrapMiraiCommand, wrapMiraiEvent } from './mirai.js';
import { wrapGoatCommand, wrapGoatEvent } from './goat.js';

/**
 * Loads Mirai-style commands and events into the registries.
 */
export async function loadMirai(
  commandRegistry: CommandRegistry, 
  eventRegistry: EventRegistry, 
  basePath: string
) {
  const cmdsPath = path.join(basePath, 'Script/commands');
  const eventsPath = path.join(basePath, 'Script/events');

  if (fs.existsSync(cmdsPath)) {
    await commandRegistry.loadCommands(cmdsPath, wrapMiraiCommand);
  }
  if (fs.existsSync(eventsPath)) {
    await eventRegistry.loadEvents(eventsPath, wrapMiraiEvent);
  }
}

/**
 * Loads Goat-style commands and events into the registries.
 */
export async function loadGoat(
  commandRegistry: CommandRegistry, 
  eventRegistry: EventRegistry, 
  basePath: string
) {
  const cmdsPath = path.join(basePath, 'scripts/cmds');
  const eventsPath = path.join(basePath, 'scripts/events');

  if (fs.existsSync(cmdsPath)) {
    await commandRegistry.loadCommands(cmdsPath, wrapGoatCommand);
  }
  if (fs.existsSync(eventsPath)) {
    await eventRegistry.loadEvents(eventsPath, wrapGoatEvent); 
  }
}

