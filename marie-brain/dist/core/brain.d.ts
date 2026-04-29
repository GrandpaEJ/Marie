import { IMarieEvent, IPlatform, MarieMiddleware } from '../types.js';
import { CommandRegistry } from './command-registry.js';
export declare class Brain {
    platform: IPlatform;
    registry: CommandRegistry;
    llm: any;
    config: any;
    dependencies: any;
    private pipeline;
    builtins: any;
    constructor(platform: IPlatform, registry: CommandRegistry, llm: any, config: any, dependencies?: any);
    use(middleware: MarieMiddleware): this;
    processMessage(event: IMarieEvent): Promise<void>;
    private _createUserFetcher;
    private _createGlobalMode;
    private _createEventHooks;
    private _createCommandRouter;
    private _createFallbackChat;
}
