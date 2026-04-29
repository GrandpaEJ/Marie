import { IMarieContext } from '../types.js';
export type MarieEventHook = (ctx: IMarieContext) => Promise<void>;
export declare class EventRegistry {
    private hooks;
    constructor();
    register(hook: MarieEventHook): void;
    loadEvents(dirPath: string, wrapper?: (mod: any) => MarieEventHook): Promise<void>;
    executeAll(ctx: IMarieContext): Promise<void>;
}
