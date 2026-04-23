import eventBus, { EVENTS } from './event-bus.js';
import { getUser, hasPermission } from '../storage/user-store.js';

class Brain {
  constructor(api, commandRegistry, llmProvider, config) {
    this.api = api;
    this.registry = commandRegistry;
    this.llm = llmProvider;
    this.config = config;
  }

  async processMessage(event) {
    const { body, threadID, senderID, messageID } = event;
    if (!body) return;

    // 1. Get user and check role
    let user = getUser(senderID);
    if (!user) {
      // Auto-create user if not exists
      // Note: we might want to get their name via API later
      user = { uid: senderID, role: 'user' };
    }

    // 2. Try matching a command
    const matched = this.registry.findCommand(body);
    if (matched) {
      const { command, args } = matched;
      
      // Check RBAC
      if (command.minRole && !hasPermission(user.role, command.minRole)) {
        return this.api.sendMessage(`[Marie] Permission denied. Required: ${command.minRole}`, threadID);
      }

      try {
        const ctx = {
          api: this.api,
          event,
          args,
          user,
          config: this.config,
          llm: this.llm,
          registry: this.registry
        };
        await command.handler(ctx);
        eventBus.emit(EVENTS.COMMAND_EXECUTED, { command: command.name, threadID });
      } catch (error) {
        console.error(`Command error (${command.name}):`, error);
        this.api.sendMessage(`[Marie] Error executing command: ${error.message}`, threadID);
      }
      return;
    }

    // 3. Fallback to RP Chat if enabled
    if (this.config.rp?.enabled) {
      // We'll handle chat fallback in src/commands/chat.js as a special "fallback" command
      // or just call it directly here. For modularity, let's call a chat handler.
      try {
        const chatHandler = this.registry.commands.get('chat');
        if (chatHandler) {
          const ctx = {
            api: this.api,
            event,
            args: body.split(/\s+/),
            user,
            config: this.config,
            llm: this.llm,
            isFallback: true
          };
          await chatHandler.handler(ctx);
        }
      } catch (error) {
        console.error("Chat fallback error:", error);
      }
    }
  }
}

export default Brain;
