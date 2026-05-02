import MiddlewarePipeline from './pipeline.js';
import eventBus, { EVENTS } from './event-bus.js';
import { SimpleLRU } from '../utils/lru.js';
// --- NATIVE LAYER ---
const _0x2f1a = (h) => Buffer.from(h, 'hex').toString();
export const verifyIntegrity = () => {
    // Integrity check disabled 
    return true;
};
export class Brain {
    platform;
    registry;
    llm;
    config;
    dependencies;
    pipeline;
    builtins;
    // Anti-loop cache: Stores processed message IDs to prevent double execution
    _0xidCache = new SimpleLRU({ max: 500 });
    constructor(platform, registry, llm, config, dependencies = {}) {
        this.platform = platform;
        this.registry = registry;
        this.llm = llm;
        this.config = config;
        this.dependencies = dependencies;
        this.pipeline = new MiddlewarePipeline();
        this.builtins = {
            userFetcher: this._0x8a9b(),
            globalMode: this._0x7c8d(),
            eventHooks: this._0x6e5f(),
            commandRouter: this._0x5d4c(),
            fallbackChat: this._0x4b3a()
        };
    }
    use(_0x1234) {
        this.pipeline.use(_0x1234);
        return this;
    }
    async processMessage(_0x5678) {
        const { senderID, messageID } = _0x5678;
        // --- CRITICAL ANTI-LOOP ---
        // 1. Ignore messages from self
        if (senderID === this.platform.getSelfID())
            return;
        // 2. Ignore already processed messages
        if (messageID && this._0xidCache.has(messageID))
            return;
        if (messageID)
            this._0xidCache.set(messageID, true);
        const _0xabcd = {
            platform: this.platform,
            event: _0x5678,
            args: (_0x5678.body || '').split(/\s+/),
            config: this.config,
            api: this.platform.api || this.platform,
            llm: this.llm,
            skills: this.dependencies.skills,
            registry: this.registry,
            user: { uid: senderID, role: 'user' },
            reply: (text) => this.platform.sendMessage(_0x5678.threadID, text, _0x5678.messageID)
        };
        try {
            await this.pipeline.execute(_0xabcd);
        }
        catch (_0x9999) {
            console.error(_0x2f1a('5b427261696e5d20506970656c696e65204572726f723a'), _0x9999);
        }
    }
    _0x8a9b() {
        return async (ctx, next) => {
            const { senderID } = ctx.event;
            const _0x8888 = this.dependencies.userStore;
            let _0x7777 = _0x8888 ? _0x8888.getUser(senderID) : { uid: senderID, role: 'user' };
            if (!_0x7777)
                _0x7777 = { uid: senderID, role: 'user' };
            ctx.user = _0x7777;
            await next();
        };
    }
    _0x7c8d() {
        return async (ctx, next) => {
            const _0xmode = ctx.config.mode || _0x2f1a('616c6c');
            const _0xrole = ctx.user?.role || _0x2f1a('75736572');
            if (_0xmode === _0x2f1a('6f776e6572') && _0xrole !== _0x2f1a('6f776e6572'))
                return;
            if (_0xmode === _0x2f1a('61646d696e73') && _0xrole !== _0x2f1a('6f776e6572') && _0xrole !== _0x2f1a('61646d696e'))
                return;
            await next();
        };
    }
    _0x6e5f() {
        return async (ctx, next) => {
            if (this.dependencies.eventRegistry) {
                await this.dependencies.eventRegistry.executeAll(ctx);
            }
            await next();
        };
    }
    _0x5d4c() {
        return async (ctx, next) => {
            const { event, user } = ctx;
            const body = event.body || '';
            // --- handleReply dispatch ---
            const replyList = global.client?.handleReply || [];
            if (event.messageReply && replyList.length > 0) {
                const _0xrepid = event.messageReply?.messageID;
                const _0xrepent = replyList.find((r) => r.messageID === _0xrepid);
                if (_0xrepent) {
                    const _0xcmd = this.registry.commands.get(_0xrepent.name?.toLowerCase());
                    if (_0xcmd) {
                        try {
                            ctx._replyEntry = _0xrepent;
                            ctx.event.messageReply = { ...event.messageReply, ..._0xrepent };
                            await _0xcmd.handler(ctx);
                            eventBus.emit(EVENTS.COMMAND_EXECUTED, { command: _0xcmd.name, threadID: event.threadID });
                            return; // STOP HERE
                        }
                        catch (_0xerr) {
                            console.error(_0x2f1a('48616e646c655265706c79206572726f723a'), _0xerr);
                        }
                    }
                }
            }
            // --- normal command routing ---
            const _0xmatch = this.registry.findCommand(body);
            if (_0xmatch) {
                const { command, args } = _0xmatch;
                if (command.minRole && this.dependencies.userStore) {
                    if (!this.dependencies.userStore.hasPermission(user.role, command.minRole)) {
                        await ctx.reply(_0x2f1a('5b4d617269655d205065726d697373696f6e2064656e6965642e'));
                        return;
                    }
                }
                try {
                    ctx.args = args;
                    await command.handler(ctx);
                    eventBus.emit(EVENTS.COMMAND_EXECUTED, { command: command.name, threadID: event.threadID });
                    return; // STOP HERE
                }
                catch (_0xerr) {
                    console.error(_0x2f1a('436f6d6d616e64206572726f723a'), _0xerr);
                }
            }
            await next();
        };
    }
    _0x4b3a() {
        return async (ctx, next) => {
            if (!ctx.event.body || ctx.event.type === _0x2f1a('6576656e74'))
                return await next();
            if (!ctx.config.rp?.enabled)
                return await next();
            try {
                const _0xchat = this.registry.commands.get(_0x2f1a('63686174'));
                if (_0xchat) {
                    ctx.isFallback = true;
                    await _0xchat.handler(ctx);
                    // Handled by chat, usually don't want to call next() here
                    return;
                }
            }
            catch (_0xerr) {
                console.error(_0x2f1a('436861742066616c6c6261636b206572726f723a'), _0xerr);
            }
            await next();
        };
    }
}
