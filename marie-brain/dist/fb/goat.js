import { safeFs } from './fallback.js';
// Initialize GOAT Global Mocks
const g = global;
if (!g.GoatBot) {
    g.GoatBot = {
        config: {
            nickNameBot: 'Marie',
            threadApproval: { enable: false }
        },
        cooldowns: new Map()
    };
}
else {
    if (!g.GoatBot.cooldowns)
        g.GoatBot.cooldowns = new Map();
}
if (!g.temp)
    g.temp = {};
if (!g.fs)
    g.fs = safeFs;
if (!g.utils) {
    g.utils = {
        getPrefix: (threadID) => global.config?.PREFIX || '.',
        getTime: () => Date.now(),
        drive: {}
    };
}
const mockThreadsData = {
    get: async (id) => ({ threadName: `Thread ${id}`, settings: {}, members: [] }),
    set: async (id, data) => true,
    getAll: async () => []
};
const mockUsersData = {
    get: async (id) => ({ name: `User ${id}` }),
    getName: async (id) => `User ${id}`,
    set: async (id, data) => true,
    getAll: async () => []
};
/**
 * Replace GoatBot {pn} prefix placeholder with the actual prefix.
 */
function replacePn(text) {
    const prefix = global.config?.PREFIX || '.';
    if (typeof text === 'string')
        return text.replace(/\{pn\}/g, prefix);
    if (text && typeof text === 'object' && text.body) {
        return { ...text, body: text.body.replace(/\{pn\}/g, prefix) };
    }
    return text;
}
/**
 * Wraps a Goat Command module into a Marie Command.
 */
export function wrapGoatCommand(rawModule) {
    const config = rawModule.config || {};
    let minRole = 'user';
    if (config.role === 1)
        minRole = 'admin';
    if (config.role === 2)
        minRole = 'owner';
    const handler = async (ctx) => {
        // Cooldown enforcement
        const cooldownTime = (config.countDown || config.cooldown || 0) * 1000;
        if (cooldownTime > 0) {
            const cooldowns = global.GoatBot.cooldowns;
            if (!cooldowns.has(config.name))
                cooldowns.set(config.name, new Map());
            const timestamps = cooldowns.get(config.name);
            const expirationTime = (timestamps.get(ctx.event.senderID) || 0) + cooldownTime;
            if (Date.now() < expirationTime) {
                const timeLeft = (expirationTime - Date.now()) / 1000;
                return ctx.reply(`[Marie] Please wait ${timeLeft.toFixed(1)}s before using this command again.`);
            }
            timestamps.set(ctx.event.senderID, Date.now());
        }
        const message = {
            send: (text, callback) => {
                ctx.platform.sendMessage(ctx.event.threadID, replacePn(text)).then(res => callback?.(null, res)).catch(callback);
            },
            reply: (text, callback) => {
                ctx.platform.sendMessage(ctx.event.threadID, replacePn(text), ctx.event.messageID).then(res => callback?.(null, res)).catch(callback);
            },
            unsend: (msgID) => {
                ctx.platform.unsendMessage?.(msgID);
            }
        };
        // Build a proxy around the raw api so api.sendMessage also replaces {pn}
        const rawApi = ctx.platform.api || ctx.platform;
        const api = new Proxy(rawApi, {
            get(target, prop) {
                if (prop === 'sendMessage') {
                    return (body, threadID, ...rest) => {
                        return target.sendMessage(replacePn(body), threadID, ...rest);
                    };
                }
                const val = target[prop];
                return typeof val === 'function' ? val.bind(target) : val;
            }
        });
        const getLang = (key, ...args) => {
            let text = rawModule.langs?.en?.[key] || key;
            args.forEach((arg, i) => {
                text = text.replace(new RegExp(`%${i + 1}`, 'g'), arg);
            });
            return replacePn(text);
        };
        const goatCtx = {
            api,
            event: ctx.event,
            args: ctx.args || [],
            message,
            threadsData: mockThreadsData,
            usersData: mockUsersData,
            getLang,
            envConfig: config.envConfig || {}
        };
        try {
            const hook = ctx._hookCall;
            if (hook && rawModule[hook]) {
                return await rawModule[hook](goatCtx);
            }
            if (rawModule.onStart) {
                return await rawModule.onStart(goatCtx);
            }
        }
        catch (e) {
            console.error(`[GoatAdapter] Command error (${config.name}):`, e);
            if (!ctx._hookCall) {
                ctx.reply(`[Marie-Goat] Error executing command: ${e.message}`);
            }
        }
    };
    return {
        name: config.name,
        aliases: config.aliases || [],
        minRole,
        handler,
        rawModule
    };
}
/**
 * Wraps a Goat Event module into a Marie Event Hook.
 */
export function wrapGoatEvent(rawModule) {
    const config = rawModule.config || {};
    // Only register as event hook if the module explicitly exports Goat event handlers
    if (!rawModule.onChat && !rawModule.onEvent && !rawModule.onAnyEvent)
        return null;
    return async (ctx) => {
        const message = {
            send: (text, callback) => {
                ctx.platform.sendMessage(ctx.event.threadID, text).then(res => callback?.(null, res)).catch(callback);
            },
            reply: (text, callback) => {
                ctx.platform.sendMessage(ctx.event.threadID, text, ctx.event.messageID).then(res => callback?.(null, res)).catch(callback);
            },
            unsend: (msgID) => {
                ctx.platform.unsendMessage?.(msgID);
            }
        };
        const getLang = (key, ...args) => {
            let text = rawModule.langs?.en?.[key] || key;
            args.forEach((arg, i) => {
                text = text.replace(new RegExp(`%${i + 1}`, 'g'), arg);
            });
            return text;
        };
        const args = (ctx.event.body || '').trim().split(/\s+/).slice(1);
        const goatCtx = {
            api: ctx.platform.api || ctx.platform,
            event: ctx.event,
            args,
            message,
            threadsData: mockThreadsData,
            usersData: mockUsersData,
            getLang,
            envConfig: config.envConfig || {}
        };
        try {
            if (rawModule.onChat)
                await rawModule.onChat(goatCtx);
            if (rawModule.onEvent)
                await rawModule.onEvent(goatCtx);
            if (rawModule.onAnyEvent)
                await rawModule.onAnyEvent(goatCtx);
        }
        catch (e) {
            console.error(`[GoatAdapter] Event error (${config.name}):`, e);
        }
    };
}
