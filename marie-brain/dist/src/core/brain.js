import MiddlewarePipeline from './pipeline.js';
import eventBus, { EVENTS } from './event-bus.js';
export class Brain {
    platform;
    registry;
    llm;
    config;
    dependencies;
    pipeline;
    builtins;
    constructor(platform, registry, llm, config, dependencies = {}) {
        this.platform = platform;
        this.registry = registry;
        this.llm = llm;
        this.config = config;
        this.dependencies = dependencies;
        this.pipeline = new MiddlewarePipeline();
        this.builtins = {
            userFetcher: this._createUserFetcher(),
            globalMode: this._createGlobalMode(),
            eventHooks: this._createEventHooks(),
            commandRouter: this._createCommandRouter(),
            fallbackChat: this._createFallbackChat()
        };
    }
    use(middleware) {
        this.pipeline.use(middleware);
        return this;
    }
    async processMessage(event) {
        const { body, senderID } = event;
        // Anti-loop
        if (senderID === this.platform.getSelfID())
            return;
        if (!body)
            return;
        const ctx = {
            platform: this.platform,
            event,
            args: body.split(/\s+/),
            config: this.config,
            llm: this.llm,
            skills: this.dependencies.skills,
            registry: this.registry,
            user: { uid: senderID, role: 'user' }, // default
            reply: (text) => this.platform.sendMessage(event.threadID, text, event.messageID)
        };
        try {
            await this.pipeline.execute(ctx);
        }
        catch (error) {
            console.error(`[Brain] Pipeline Error:`, error);
        }
    }
    _createUserFetcher() {
        return async (ctx, next) => {
            const { senderID } = ctx.event;
            const userStore = this.dependencies.userStore;
            let user = userStore ? userStore.getUser(senderID) : { uid: senderID, role: 'user' };
            if (!user)
                user = { uid: senderID, role: 'user' };
            ctx.user = user;
            await next();
        };
    }
    _createGlobalMode() {
        return async (ctx, next) => {
            const mode = ctx.config.mode || 'all';
            const role = ctx.user?.role || 'user';
            if (mode === 'owner' && role !== 'owner')
                return;
            if (mode === 'admins' && role !== 'owner' && role !== 'admin')
                return;
            await next();
        };
    }
    _createEventHooks() {
        return async (ctx, next) => {
            if (this.dependencies.eventRegistry) {
                await this.dependencies.eventRegistry.executeAll(ctx);
            }
            await next();
        };
    }
    _createCommandRouter() {
        return async (ctx, next) => {
            const { event, user } = ctx;
            const body = event.body;
            const matched = this.registry.findCommand(body);
            if (matched) {
                const { command, args } = matched;
                if (command.minRole && this.dependencies.userStore) {
                    if (!this.dependencies.userStore.hasPermission(user.role, command.minRole)) {
                        await ctx.reply(`[Marie] Permission denied. Required: ${command.minRole}`);
                        return;
                    }
                }
                try {
                    ctx.args = args;
                    await command.handler(ctx);
                    eventBus.emit(EVENTS.COMMAND_EXECUTED, { command: command.name, threadID: event.threadID });
                }
                catch (error) {
                    console.error(`Command error (${command.name}):`, error);
                    await ctx.reply(`[Marie] Error executing command: ${error.message}`);
                }
                return;
            }
            await next();
        };
    }
    _createFallbackChat() {
        return async (ctx, next) => {
            if (!ctx.config.rp?.enabled)
                return await next();
            try {
                const chatHandler = this.registry.commands.get('chat');
                if (chatHandler) {
                    ctx.isFallback = true;
                    await chatHandler.handler(ctx);
                }
            }
            catch (error) {
                console.error("Chat fallback error:", error);
            }
            await next();
        };
    }
}
