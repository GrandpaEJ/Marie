import { IMarieContext, ICommand } from '../types.js';
/**
 * Wraps a Mirai Command module into a Marie Command.
 */
export declare function wrapMiraiCommand(rawModule: any): ICommand;
/**
 * Wraps a Mirai Event module into a Marie Event Hook.
 */
export declare function wrapMiraiEvent(rawModule: any): (ctx: IMarieContext) => Promise<void>;
