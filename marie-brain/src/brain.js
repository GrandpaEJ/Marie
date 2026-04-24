import eventBus, { EVENTS } from './event-bus.js';
import MiddlewarePipeline from './pipeline.js';

/**
 * Universal Brain for an AI agent.
 * Powered by a robust Middleware Pipeline.
 */
class Brain {
  constructor(api, commandRegistry, llmProvider, config, dependencies = {}) {
    this.api = api;
    this.registry = commandRegistry;
    this.llm = llmProvider;
    this.config = config;
    this.userStore = dependencies.userStore;
    this.skills = dependencies.skills;
    
    this.pipeline = new MiddlewarePipeline();

    // Built-in Middlewares for easy registration by the host
    this.builtins = {
      userFetcher: this._createUserFetcher(),
      globalMode: this._createGlobalMode(),
      commandRouter: this._createCommandRouter(),
      fallbackChat: this._createFallbackChat()
    };
  }

  /**
   * Register a middleware to the Brain's pipeline.
   */
  use(middleware) {
    this.pipeline.use(middleware);
    return this;
  }

  /**
   * Main entry point for incoming events.
   */
  async processMessage(event) {
    const { body, threadID, senderID } = event;

    // 0. Base anti-loop (always runs before pipeline to prevent catastrophic loops)
    if (senderID === this.api.getCurrentUserID()) return;
    if (!body) return;

    // Construct the context object
    const ctx = {
      api: this.api,
      event,
      args: body.split(/\s+/),
      config: this.config,
      llm: this.llm,
      skills: this.skills,
      registry: this.registry,
      user: null // populated by userFetcher
    };

    try {
      await this.pipeline.execute(ctx);
    } catch (error) {
      console.error(`[Brain] Pipeline Error:`, error);
    }
  }

  // --- Built-in Middleware Factories ---

  _createUserFetcher() {
    return async (ctx, next) => {
      const { senderID } = ctx.event;
      let user = this.userStore ? this.userStore.getUser(senderID) : { uid: senderID, role: 'user' };
      if (!user) user = { uid: senderID, role: 'user' };
      ctx.user = user;
      await next();
    };
  }

  _createGlobalMode() {
    return async (ctx, next) => {
      const mode = ctx.config.mode || 'all';
      const role = ctx.user?.role || 'user';
      
      if (mode === 'owner' && role !== 'owner') return;
      if (mode === 'admins' && role !== 'owner' && role !== 'admin') return;
      
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

        // Check Command RBAC
        if (command.minRole && this.userStore) {
          if (!this.userStore.hasPermission(user.role, command.minRole)) {
            return ctx.api.sendMessage(`[Marie] Permission denied. Required: ${command.minRole}`, event.threadID);
          }
        }

        try {
          ctx.args = args; // Update ctx.args with parsed command args
          await command.handler(ctx);
          eventBus.emit(EVENTS.COMMAND_EXECUTED, { command: command.name, threadID: event.threadID });
        } catch (error) {
          console.error(`Command error (${command.name}):`, error);
          ctx.api.sendMessage(`[Marie] Error executing command: ${error.message}`, event.threadID);
        }
        
        // Command intercepted the request, do NOT call next()
        return; 
      }

      // Not a command, proceed down the pipeline
      await next();
    };
  }

  _createFallbackChat() {
    return async (ctx, next) => {
      if (!ctx.config.rp?.enabled) return await next();

      console.log(`[Brain] Routing to fallback RP chat...`);
      try {
        const chatHandler = this.registry.commands.get('chat');
        if (chatHandler) {
          ctx.isFallback = true;
          await chatHandler.handler(ctx);
        }
      } catch (error) {
        console.error("Chat fallback error:", error);
      }
      
      await next();
    };
  }
}

export default Brain;
