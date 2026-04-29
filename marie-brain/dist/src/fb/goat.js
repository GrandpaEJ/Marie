import { safeFs } from './fallback.js';
// Initialize GOAT Global Mocks
const g = global;
if (!g.GoatBot) {
    g.GoatBot = {
        config: {
            nickNameBot: 'Marie',
            threadApproval: { enable: false }
        }
    };
}
if (!g.temp)
    g.temp = {};
if (!g.fs)
    g.fs = safeFs;
if (!g.utils) {
    g.utils = {
        getPrefix: () => '.',
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
        const goatCtx = {
            api: ctx.platform.api || ctx.platform, // Compatibility with legacy expecting api
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
        const goatCtx = {
            api: ctx.platform.api || ctx.platform,
            event: ctx.event,
            message,
            threadsData: mockThreadsData,
            usersData: mockUsersData,
            getLang,
            envConfig: config.envConfig || {}
        };
        try {
            if (rawModule.onStart) {
                const result = await rawModule.onStart(goatCtx);
                if (typeof result === 'function') {
                    await result();
                }
            }
        }
        catch (e) {
            console.error(`[GoatAdapter] Event error (${config.name}):`, e);
        }
    };
}
