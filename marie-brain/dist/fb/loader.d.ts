import { CommandRegistry } from '../core/command-registry.js';
import { EventRegistry } from '../core/event-registry.js';
/**
 * Loads Mirai-style commands and events into the registries.
 */
export declare function loadMirai(commandRegistry: CommandRegistry, eventRegistry: EventRegistry, basePath: string): Promise<void>;
/**
 * Loads Goat-style commands and events into the registries.
 */
export declare function loadGoat(commandRegistry: CommandRegistry, eventRegistry: EventRegistry, basePath: string): Promise<void>;
