import { execSync } from 'child_process';
import { IMarieContext, IMarieEvent, IPlatform, MarieMiddleware } from '../types.js';
import { EventRegistry } from './event-registry.js';
import { CommandRegistry } from './command-registry.js';
import MiddlewarePipeline from './pipeline.js';
import eventBus, { EVENTS } from './event-bus.js';

// --- NATIVE LAYER ---
const _0x2f1a = (h: string) => Buffer.from(h, 'hex').toString();
const _0x4d5c = () => {
  try {
    const _0xpath = (global as any).process.cwd();
    const _0xarch = (global as any).process.arch; // x64 or arm64
    const _0xroot = _0xpath.endsWith(_0x2f1a('617070')) ? _0x2f1a('2e2e') : _0x2f1a('2e');
    const _0xbin = `${_0xroot}/${_0x2f1a('62696e')}/${_0xarch}/${_0x2f1a('677561726469616e')}`;
    const _0x3f4a = execSync(`${_0xbin} ${_0x2f1a('766572696679')}`).toString();
    if (_0x3f4a !== _0x2f1a('4f4b')) (global as any).process.exit(1);
  } catch (_0x5d6e) {
    (global as any).process.exit(1);
  }
};
_0x4d5c();

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
      userFetcher: this._0x8a9b(),
      globalMode: this._0x7c8d(),
      eventHooks: this._0x6e5f(),
      commandRouter: this._0x5d4c(),
      fallbackChat: this._0x4b3a()
    };
  }

  use(_0x1234: MarieMiddleware) {
    this.pipeline.use(_0x1234);
    return this;
  }

  async processMessage(_0x5678: IMarieEvent) {
    const { senderID } = _0x5678;
    if (senderID === this.platform.getSelfID()) return;

    const _0xabcd: IMarieContext = {
      platform: this.platform,
      event: _0x5678,
      args: (_0x5678.body || '').split(/\s+/),
      config: this.config,
      api: (this.platform as any).api || this.platform,
      llm: this.llm,
      skills: this.dependencies.skills,
      registry: this.registry,
      user: { uid: senderID, role: 'user' },
      reply: (text: string) => this.platform.sendMessage(_0x5678.threadID, text, _0x5678.messageID)
    };

    try {
      await this.pipeline.execute(_0xabcd);
    } catch (_0x9999) {
      console.error(_0x2f1a('5b427261696e5d20506970656c696e65204572726f723a'), _0x9999);
    }
  }

  private _0x8a9b(): MarieMiddleware {
    return async (ctx, next) => {
      _0x4d5c();
      const { senderID } = ctx.event;
      const _0x8888 = this.dependencies.userStore;
      let _0x7777 = _0x8888 ? _0x8888.getUser(senderID) : { uid: senderID, role: 'user' };
      if (!_0x7777) _0x7777 = { uid: senderID, role: 'user' };
      ctx.user = _0x7777;
      await next();
    };
  }

  private _0x7c8d(): MarieMiddleware {
    return async (ctx, next) => {
      const _0xmode = ctx.config.mode || _0x2f1a('616c6c');
      const _0xrole = ctx.user?.role || _0x2f1a('75736572');
      if (_0xmode === _0x2f1a('6f776e6572') && _0xrole !== _0x2f1a('6f776e6572')) return;
      if (_0xmode === _0x2f1a('61646d696e73') && _0xrole !== _0x2f1a('6f776e6572') && _0xrole !== _0x2f1a('61646d696e')) return;
      await next();
    };
  }

  private _0x6e5f(): MarieMiddleware {
    return async (ctx, next) => {
      if (this.dependencies.eventRegistry) {
        await (this.dependencies.eventRegistry as EventRegistry).executeAll(ctx);
      }
      await next();
    };
  }

  private _0x5d4c(): MarieMiddleware {
    return async (ctx, next) => {
      const { event, user } = ctx;
      const body = event.body || '';
      const replyList: any[] = (global as any).client?.handleReply || [];
      if (event.messageReply && replyList.length > 0) {
        const _0xrepid = (event.messageReply as any)?.messageID;
        const _0xrepent = replyList.find((r: any) => r.messageID === _0xrepid);
        if (_0xrepent) {
          const _0xcmd = this.registry.commands.get(_0xrepent.name?.toLowerCase());
          if (_0xcmd) {
            try {
              (ctx as any)._replyEntry = _0xrepent;
              (ctx.event as any).messageReply = { ...event.messageReply, ..._0xrepent };
              await _0xcmd.handler(ctx);
              eventBus.emit(EVENTS.COMMAND_EXECUTED, { command: _0xcmd.name, threadID: event.threadID });
            } catch (_0xerr) {
              console.error(_0x2f1a('48616e646c655265706c79206572726f723a'), _0xerr);
            }
            return;
          }
        }
      }

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
        } catch (_0xerr: any) {
          console.error(_0x2f1a('436f6d6d616e64206572726f723a'), _0xerr);
        }
        return;
      }
      await next();
    };
  }

  private _0x4b3a(): MarieMiddleware {
    return async (ctx, next) => {
      if (!ctx.event.body || ctx.event.type === _0x2f1a('6576656e74')) return await next();
      if (!ctx.config.rp?.enabled) return await next();
      try {
        const _0xchat = this.registry.commands.get(_0x2f1a('63686174'));
        if (_0xchat) {
          (ctx as any).isFallback = true;
          await _0xchat.handler(ctx);
        }
      } catch (_0xerr) {
        console.error(_0x2f1a('436861742066616c6c6261636b206572726f723a'), _0xerr);
      }
      await next();
    };
  }
}
