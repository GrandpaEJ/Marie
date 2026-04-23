import eventBus, { EVENTS } from './event-bus.js';

/**
 * Universal Brain for an AI agent.
 * Handles command routing, RBAC, and fallback logic.
 */
class Brain {
  /**
   * @param {Object} api - The messaging API (must have sendMessage)
   * @param {Object} commandRegistry - Instance of CommandRegistry
   * @param {Object} llmProvider - Instance of LLMProvider
   * @param {Object} config - Configuration object
   * @param {Object} dependencies - { userStore }
   */
  constructor(api, commandRegistry, llmProvider, config, dependencies = {}) {
    this.api = api;
    this.registry = commandRegistry;
    this.llm = llmProvider;
    this.config = config;
    this.userStore = dependencies.userStore;
  }

  async processMessage(event) {
    const { body, threadID, senderID } = event;
    if (!body) return;

    console.log(`[Brain] Processing message from ${senderID} in ${threadID}: "${body.slice(0, 50)}..."`);

    // 1. Get user and check role
    let user = this.userStore ? this.userStore.getUser(senderID) : { uid: senderID, role: 'user' };
    if (!user) {
      user = { uid: senderID, role: 'user' };
    }

    // 2. Try matching a command
    const matched = this.registry.findCommand(body);
    if (matched) {
      const { command, args } = matched;

      // Check RBAC
      if (command.minRole && this.userStore) {
        if (!this.userStore.hasPermission(user.role, command.minRole)) {
          return this.api.sendMessage(`[Marie] Permission denied. Required: ${command.minRole}`, threadID);
        }
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
      console.log(`[Brain] Falling back to RP chat...`);
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
