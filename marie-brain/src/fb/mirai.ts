import { IMarieContext, ICommand } from '../types.js';
import { safeFs } from './fallback.js';


// Initialize Mirai Global Mocks
const g = global as any;
if (!g.client) {
  g.client = {
    commands: new Map(),
    events: new Map(),
    aliases: new Map(),
    cooldowns: new Map(),
    handleReply: [],
    handleEvent: [],
    mainPath: process.cwd(),
    configPath: "",
    getTime: (option: any) => Date.now()
  };
} else {
  if (!g.client.handleReply) g.client.handleReply = [];
  if (!g.client.handleEvent) g.client.handleEvent = [];
}
if (!g.fs) g.fs = safeFs;

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

// Global configModule — legacy scripts read global.configModule[commandName].someOption
if (!g.configModule) g.configModule = new Proxy({} as Record<string, any>, {
  get(target, prop: string) {
    if (!target[prop]) target[prop] = {};
    return target[prop];
  }
});

// Global configCommands — similar pattern used by some commands
if (!g.configCommands) g.configCommands = new Proxy({} as Record<string, any>, {
  get(target, prop: string) {
    if (!target[prop]) target[prop] = {};
    return target[prop];
  }
});

const mockUsers = {
  getNameUser: async (id: string) => `User ${id}`,
  getData: async (id: string) => ({ name: `User ${id}`, money: 0, exp: 0 }),
  setData: async (id: string, data: any) => true,
  delData: async (id: string) => true
};

const mockThreads = {
  getInfo: async (id: string) => ({ threadName: `Thread ${id}`, participantIDs: [] }),
  getData: async (id: string) => ({ threadInfo: { threadName: `Thread ${id}` } }),
  setData: async (id: string, data: any) => true,
  delData: async (id: string) => true
};

const mockCurrencies = {
  getData: async (id: string) => ({ money: 0, exp: 0 }),
  setData: async (id: string, data: any) => true,
  increaseMoney: async (id: string, money: number) => true,
  decreaseMoney: async (id: string, money: number) => true
};

/** Map Marie user role to Mirai permission level (0=user, 1=admin, 2=owner) */
function roleToPermssion(role?: string): number {
  if (role === 'owner') return 2;
  if (role === 'admin') return 1;
  return 0;
}

/** Build the shared Mirai-compatible API wrapper from a Marie platform. */
function buildMiraiApi(ctx: IMarieContext) {
  const platform = (ctx.platform as any);
  const api = platform.api || platform;
  return api;
}

/** Build the Mirai message helper object. */
function buildMessage(ctx: IMarieContext) {
  return {
    send: (text: any, callback?: any) => {
      ctx.platform.sendMessage(ctx.event.threadID, text)
        .then(res => callback?.(null, res))
        .catch(err => callback?.(err));
    },
    reply: (text: any, callback?: any) => {
      ctx.platform.sendMessage(ctx.event.threadID, text, ctx.event.messageID)
        .then(res => callback?.(null, res))
        .catch(err => callback?.(err));
    },
    unsend: (msgID: string) => {
      (ctx.platform as any).unsendMessage?.(msgID);
    }
  };
}

/** Build getText helper from rawModule.languages */
function buildGetText(rawModule: any) {
  return (key: string, ...args: any[]) => {
    let text = rawModule.languages?.en?.[key] || rawModule.langs?.en?.[key] || key;
    args.forEach((arg, i) => {
      text = text.replace(new RegExp(`%${i + 1}`, 'g'), String(arg));
    });
    return text;
  };
}

/**
 * Wraps a Mirai Command module into a Marie Command.
 */
export function wrapMiraiCommand(rawModule: any): ICommand {
  const config = rawModule.config || {};
  let minRole: 'user' | 'admin' | 'owner' = 'user';
  if (config.hasPermssion === 1) minRole = 'admin';
  if (config.hasPermssion === 2) minRole = 'owner';

  // Run onLoad if present (called once at load time)
  try {
    if (rawModule.onLoad) rawModule.onLoad({ configModule: (global as any).configModule });
  } catch (e) {
    // silent
  }

  const handler = async (ctx: IMarieContext) => {
    const getText = buildGetText(rawModule);

    // Cooldown enforcement
    const cooldownTime = (config.countDown || config.cooldown || 0) * 1000;
    if (cooldownTime > 0) {
      const cooldowns = (global as any).client.cooldowns;
      if (!cooldowns.has(config.name)) cooldowns.set(config.name, new Map());
      const timestamps = cooldowns.get(config.name);
      const expirationTime = (timestamps.get(ctx.event.senderID) || 0) + cooldownTime;
      
      if (Date.now() < expirationTime) {
        const timeLeft = (expirationTime - Date.now()) / 1000;
        return ctx.reply(getText('cooldown', timeLeft.toFixed(1)) || `[Marie] Please wait ${timeLeft.toFixed(1)}s before using this command again.`);
      }
      timestamps.set(ctx.event.senderID, Date.now());
    }

    const api = buildMiraiApi(ctx);
    const message = buildMessage(ctx);
    const permssion = roleToPermssion(ctx.user?.role);
    const args = (ctx as any).args || [];
    const prefix = (global as any).config?.PREFIX || '.';

    const miraiCtx = {
      api,
      event: ctx.event,
      args,
      commandName: config.name,
      permssion,
      prefix,
      message,
      client: (global as any).client,
      __GLOBAL: (global as any).data,
      Users: mockUsers,
      Threads: mockThreads,
      Currencies: mockCurrencies,
      getText,
      // Legacy: some commands use this.config inside run
      config
    };

    try {
      // Check for pending handleReply for this message
      const replyList: any[] = (global as any).client?.handleReply || [];
      const replyEntry = ctx.event.messageReply
        ? replyList.find((r: any) => r.messageID === ctx.event.messageReply?.messageID)
        : null;

      if (replyEntry && replyEntry.name === config.name && rawModule.handleReply) {
        // Remove from queue
        const idx = replyList.indexOf(replyEntry);
        if (idx > -1) replyList.splice(idx, 1);
        return await rawModule.handleReply({ ...miraiCtx, handleReply: replyEntry });
      }

      if (rawModule.run) {
        return await rawModule.run(miraiCtx);
      }
    } catch (e: any) {
      console.error(`[MiraiAdapter] Command error (${config.name}):`, e);
      ctx.reply(`[Marie] Error: ${e.message}`);
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
 * Returns null if the module has no handleEvent (command-only scripts are skipped).
 */
export function wrapMiraiEvent(rawModule: any) {
  // Only register as event hook if the module explicitly exports handleEvent
  if (!rawModule.handleEvent) return null;

  // Run onLoad if present
  try {
    if (rawModule.onLoad) rawModule.onLoad({ configModule: (global as any).configModule });
  } catch (e) {
    // silent
  }

  return async (ctx: IMarieContext) => {
    const api = buildMiraiApi(ctx);
    const message = buildMessage(ctx);
    const getText = buildGetText(rawModule);
    const permssion = roleToPermssion(ctx.user?.role);
    const args = (ctx.event.body || '').trim().split(/\s+/).slice(1);
    const prefix = (global as any).config?.PREFIX || '.';

    const miraiCtx = {
      api,
      event: ctx.event,
      args,
      commandName: (ctx.event.body || '').trim().split(/\s+/)[0] || '',
      permssion,
      prefix,
      message,
      client: (global as any).client,
      __GLOBAL: (global as any).data,
      Users: mockUsers,
      Threads: mockThreads,
      Currencies: mockCurrencies,
      getText
    };

    try {
      if (rawModule.handleEvent) {
        await rawModule.handleEvent(miraiCtx);
      } else if (rawModule.run) {
        await rawModule.run(miraiCtx);
      }
    } catch (e: any) {
      console.error(`[MiraiAdapter] Event error (${rawModule.config?.name || 'unknown'}):`, e);
    }
  };
}
