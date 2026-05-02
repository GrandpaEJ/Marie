/**
 * Adapter for GOAT-BOT's Commands and Events.
 * Translates Marie context to GOAT's context.
 */
// Initialize GOAT Global Mocks
if (!global.GoatBot) {
    global.GoatBot = {
        config: {
            nickNameBot: 'Marie',
            threadApproval: { enable: false }
        }
    };
}
if (!global.temp)
    global.temp = {};
if (!global.utils) {
    global.utils = {
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
                ctx.api.sendMessage(text, ctx.event.threadID, callback);
            },
            reply: (text, callback) => {
                ctx.api.sendMessage(text, ctx.event.threadID, ctx.event.messageID, callback);
            },
            unsend: (msgID) => {
                ctx.api.unsendMessage(msgID);
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
            api: ctx.api,
            event: ctx.event,
            args: ctx.args,
            message,
            threadsData: mockThreadsData,
            usersData: mockUsersData,
            getLang,
            envConfig: config.envConfig || {}
        };
        try {
            // Route based on hook call
            const hook = ctx._hookCall;
            if (hook && rawModule[hook]) {
                return await rawModule[hook](goatCtx);
            }
            // Default to onStart (standard command execution)
            if (rawModule.onStart) {
                return await rawModule.onStart(goatCtx);
            }
        }
        catch (e) {
            console.error(`[GoatAdapter] Command error (${config.name}):`, e);
            if (!ctx._hookCall) { // Only send error message for direct commands
                ctx.api.sendMessage(`[Marie-Goat] Error executing command: ${e.message}`, ctx.event.threadID);
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
                ctx.api.sendMessage(text, ctx.event.threadID, callback);
            },
            reply: (text, callback) => {
                ctx.api.sendMessage(text, ctx.event.threadID, ctx.event.messageID, callback);
            },
            unsend: (msgID) => {
                ctx.api.unsendMessage(msgID);
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
            api: ctx.api,
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
                // Goat events sometimes return a function to be executed if conditions met
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
