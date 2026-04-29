import { safeFs } from './fallback.js';
// Initialize Mirai Global Mocks
const g = global;
if (!g.client) {
    g.client = {
        commands: new Map(),
        events: new Map(),
        aliases: new Map(),
        cooldowns: new Map(),
        mainPath: process.cwd(),
        configPath: "",
        getTime: (option) => Date.now()
    };
}
if (!g.fs)
    g.fs = safeFs;
if (!g.data) {
    g.data = {
        threadData: new Map(),
        threadInfo: new Map(),
        userName: new Map(),
        userBanned: new Map(),
        threadBanned: new Map(),
        commandBanned: new Map(),
        threadAllowNSFW: new Array(),
        allUserID: new Array(),
        allCurrenciesID: new Array(),
        allThreadID: new Array()
    };
}
const mockUsers = {
    getNameUser: async (id) => `User ${id}`,
    getData: async (id) => ({ name: `User ${id}`, money: 0, exp: 0 }),
    setData: async (id, data) => true,
    delData: async (id) => true
};
const mockThreads = {
    getInfo: async (id) => ({ threadName: `Thread ${id}`, participantIDs: [] }),
    getData: async (id) => ({ threadInfo: { threadName: `Thread ${id}` } }),
    setData: async (id, data) => true,
    delData: async (id) => true
};
const mockCurrencies = {
    getData: async (id) => ({ money: 0, exp: 0 }),
    setData: async (id, data) => true,
    increaseMoney: async (id, money) => true,
    decreaseMoney: async (id, money) => true
};
/**
 * Wraps a Mirai Command module into a Marie Command.
 */
export function wrapMiraiCommand(rawModule) {
    const config = rawModule.config || {};
    let minRole = 'user';
    if (config.hasPermssion === 1)
        minRole = 'admin';
    if (config.hasPermssion === 2)
        minRole = 'owner';
    const handler = async (ctx) => {
        const getText = (key, ...args) => {
            let textL = rawModule.languages?.en?.[key] || key;
            args.forEach((arg, i) => {
                textL = textL.replace(new RegExp(`%${i + 1}`, 'g'), arg);
            });
            return textL;
        };
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
        const miraiCtx = {
            api: ctx.platform.api || ctx.platform,
            event: ctx.event,
            args: ctx.args || [],
            client: global.client,
            __GLOBAL: global.data,
            Users: mockUsers,
            Threads: mockThreads,
            Currencies: mockCurrencies,
            getText,
            message
        };
        try {
            if (rawModule.run) {
                return await rawModule.run(miraiCtx);
            }
        }
        catch (e) {
            console.error(`[MiraiAdapter] Command error (${config.name}):`, e);
            ctx.reply(`[Marie-Mirai] Error executing command: ${e.message}`);
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
 * Wraps a Mirai Event module into a Marie Event Hook.
 */
export function wrapMiraiEvent(rawModule) {
    return async (ctx) => {
        const getText = (key, ...args) => {
            let textL = rawModule.languages?.en?.[key] || key;
            args.forEach((arg, i) => {
                textL = textL.replace(new RegExp(`%${i + 1}`, 'g'), arg);
            });
            return textL;
        };
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
        const miraiCtx = {
            api: ctx.platform.api || ctx.platform,
            event: ctx.event,
            client: global.client,
            __GLOBAL: global.data,
            Users: mockUsers,
            Threads: mockThreads,
            Currencies: mockCurrencies,
            getText,
            message
        };
        try {
            if (rawModule.handleEvent) {
                await rawModule.handleEvent(miraiCtx);
            }
            else if (rawModule.run) {
                await rawModule.run(miraiCtx);
            }
        }
        catch (e) {
            console.error(`[MiraiAdapter] Event error:`, e);
        }
    };
}
