import { IMarieContext, ICommand } from '../types.js';
/**
 * Wraps a Goat Command module into a Marie Command.
 */
export declare function wrapGoatCommand(rawModule: any): ICommand;
/**
 * Wraps a Goat Event module into a Marie Event Hook.
 */
export declare function wrapGoatEvent(rawModule: any): ((ctx: IMarieContext) => Promise<void>) | null;
