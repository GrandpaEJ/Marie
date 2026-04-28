import { IMarieContext, IMarieEvent, IPlatform, MarieMiddleware } from '../types.js';
import { EventRegistry } from './event-registry.js';
import { CommandRegistry } from './command-registry.js';
import MiddlewarePipeline from './pipeline.js';
import eventBus, { EVENTS } from './event-bus.js';

export class Brain {
  private pipeline: MiddlewarePipeline;
  public builtins: any;

  constructor(
    public platform: IPlatform,
    public registry: CommandRegistry,
    public llm: any,
    public config: any,
    public dependencies: any = {}
  ) {
    this.pipeline = new MiddlewarePipeline();
    
    this.builtins = {
      userFetcher: this._createUserFetcher(),
      globalMode: this._createGlobalMode(),
      eventHooks: this._createEventHooks(),
      commandRouter: this._createCommandRouter(),
      fallbackChat: this._createFallbackChat()
    };
  }

  use(middleware: MarieMiddleware) {
    this.pipeline.use(middleware);
    return this;
  }

  async processMessage(event: IMarieEvent) {
    const { senderID } = event;

    // Anti-loop
    if (senderID === this.platform.getSelfID()) return;

    const ctx: IMarieContext = {
      platform: this.platform,
      event,
      args: (event.body || '').split(/\s+/),
      config: this.config,
      api: (this.platform as any).api || this.platform,
      llm: this.llm,
      skills: this.dependencies.skills,
      registry: this.registry,
      user: { uid: senderID, role: 'user' }, // default
      reply: (text: string) => this.platform.sendMessage(event.threadID, text, event.messageID)
    };

    try {
      await this.pipeline.execute(ctx);
    } catch (error) {
      console.error(`[Brain] Pipeline Error:`, error);
    }
  }

  private _createUserFetcher(): MarieMiddleware {
    return async (ctx, next) => {
      const { senderID } = ctx.event;
      const userStore = this.dependencies.userStore;
      let user = userStore ? userStore.getUser(senderID) : { uid: senderID, role: 'user' };
      if (!user) user = { uid: senderID, role: 'user' };
      ctx.user = user;
      await next();
    };
  }

  private _createGlobalMode(): MarieMiddleware {
    return async (ctx, next) => {
      const mode = ctx.config.mode || 'all';
      const role = ctx.user?.role || 'user';

      if (mode === 'owner' && role !== 'owner') return;
      if (mode === 'admins' && role !== 'owner' && role !== 'admin') return;

      await next();
    };
  }

  private _createEventHooks(): MarieMiddleware {
    return async (ctx, next) => {
      if (this.dependencies.eventRegistry) {
        await (this.dependencies.eventRegistry as EventRegistry).executeAll(ctx);
      }
      await next();
    };
  }

  private _createCommandRouter(): MarieMiddleware {
    return async (ctx, next) => {
      const { event, user } = ctx;
      const body = event.body || '';

      // --- handleReply dispatch ---
      // If this message is a reply, check if any command registered a reply handler
      const replyList: any[] = (global as any).client?.handleReply || [];
      if (event.messageReply && replyList.length > 0) {
        const repliedMsgID = (event.messageReply as any)?.messageID;
        const replyEntry = replyList.find((r: any) => r.messageID === repliedMsgID);
        if (replyEntry) {
          const command = this.registry.commands.get(replyEntry.name?.toLowerCase());
          if (command) {
            try {
              (ctx as any)._replyEntry = replyEntry;
              (ctx.event as any).messageReply = { ...event.messageReply, ...replyEntry };
              await command.handler(ctx);
              eventBus.emit(EVENTS.COMMAND_EXECUTED, { command: command.name, threadID: event.threadID });
            } catch (error: any) {
              console.error(`HandleReply error (${command.name}):`, error);
            }
            return;
          }
        }
      }

      // --- normal command routing ---
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
        } catch (error: any) {
          console.error(`Command error (${command.name}):`, error);
          await ctx.reply(`[Marie] Error executing command: ${error.message}`);
        }
        return;
      }
      await next();
    };
  }

  private _createFallbackChat(): MarieMiddleware {
    return async (ctx, next) => {
      // Only handle actual messages with body (not log events)
      if (!ctx.event.body || ctx.event.type === 'event' || ctx.event.type?.startsWith('log:')) {
        return await next();
      }
      if (!ctx.config.rp?.enabled) return await next();

      try {
        const chatHandler = this.registry.commands.get('chat');
        if (chatHandler) {
          (ctx as any).isFallback = true;
          await chatHandler.handler(ctx);
        }
      } catch (error) {
        console.error("Chat fallback error:", error);
      }
      await next();
    };
  }
}
