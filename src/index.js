#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import login from '@marie/fca';
import { LRUCache } from 'lru-cache';
import { loadConfig } from './utils/config.js';
import logger from './utils/logger.js';
import { LLMProvider } from '@marie/llm';
import { 
  Brain, 
  CommandRegistry, 
  EventRegistry, 
  FBPlatform,
  eventBus, 
  EVENTS, 
  setupFBEnvironment,
  loadMirai,
  loadGoat,
  wrapMiraiCommand,
  wrapGoatCommand,
  wrapMiraiEvent,
  wrapGoatEvent
} from '@marie/brain';
import { SkillManager } from '@marie/skills';
import * as userStore from './storage/user-store.js';
import * as threadStore from './storage/thread-store.js';
import db from './storage/db.js';

async function start() {
  try {
    logger.info("Starting Marie v1...");
    const config = loadConfig();
    
    // 0. Setup Facebook Compatibility Environment
    setupFBEnvironment({ prefix: config.prefix, admins: config.admins, owner: config.owner });

    // 1. Initialize LLM
    const llm = new LLMProvider(config.openrouter_api_key);
    logger.success("LLM Provider initialized.");

    // 2. Load Commands
    const registry = new CommandRegistry(config.prefix);
    const eventRegistry = new EventRegistry();

    const nativeCommandsPath = path.join(process.cwd(), 'src/commands');
    await registry.loadCommands(nativeCommandsPath);

    // Load Promoted Legacy Scripts (Precedence)
    const miraiPromotedPath = path.join(nativeCommandsPath, 'mirai');
    if (fs.existsSync(miraiPromotedPath)) {
      await registry.loadCommands(miraiPromotedPath, wrapMiraiCommand);
      await eventRegistry.loadEvents(miraiPromotedPath, wrapMiraiEvent);
    }
    const goatPromotedPath = path.join(nativeCommandsPath, 'goat');
    if (fs.existsSync(goatPromotedPath)) {
      await registry.loadCommands(goatPromotedPath, wrapGoatCommand);
      await eventRegistry.loadEvents(goatPromotedPath, wrapGoatEvent);
    }


    // 2.6 Load Skills
    const skills = new SkillManager();
    const toolsPath = path.join(process.cwd(), 'marie-skills/dist/tools');
    await skills.loadTools(toolsPath);

    // 2.7 Sync global.client.commands for legacy script compatibility
    const g = global;
    if (g.client) {
      for (const [name, cmd] of registry.commands.entries()) {
        g.client.commands.set(name, cmd.rawModule || cmd);
      }
    }

    // 3. Setup Storage & Owner
    userStore.ensureOwner(config.owner, "Bot Owner");

    // 4. Facebook Login
    let appState;
    if (fs.existsSync(config.appstate_path)) {
      appState = JSON.parse(fs.readFileSync(config.appstate_path, 'utf8'));
    } else {
      logger.error(`Appstate not found at ${config.appstate_path}.`);
      process.exit(1);
    }

    login({ appState }, async (err, api) => {
      if (err) {
        logger.error("Login failed:", err);
        return;
      }

      logger.success("Connected to Facebook.");

      // 5. Initialize Brain with dependencies
      const platform = new FBPlatform(api);
      const brain = new Brain(platform, registry, llm, config, {
        userStore,
        threadStore,
        db,
        skills,
        eventRegistry
      });

      // --- 6. Assemble Middleware Pipeline ---
      
      // 6a. Custom Deduplication Middleware
      const processedMessages = new LRUCache({ max: 500 }); 
      
      brain.use(async (ctx, next) => {
        const msgID = ctx.event.messageID;
        if (processedMessages.has(msgID)) return;
        processedMessages.set(msgID, true);
        await next();
      });

      // 6b. Built-in Middlewares
      brain.use(brain.builtins.userFetcher);
      
      // 6c. RBAC Middleware
      import('./middlewares/rbac.js').then(m => {
        brain.use(m.default(userStore));
      });

      brain.use(brain.builtins.globalMode);
      brain.use(brain.builtins.eventHooks);
      brain.use(brain.builtins.commandRouter);
      brain.use(brain.builtins.fallbackChat);

      // --- 7. Start Listening ---
      if (api && typeof api.setOptions === 'function') {
        api.setOptions(config.fca_options || {
          listenEvents: true,
          selfListen: false,
          logLevel: "silent"
        });
      }

      api.listenMqtt(async (err, event) => {
        if (err) {
          logger.error("Mqtt error:", err);
          return;
        }

        // Allow: messages, replies, and log events (join/leave/etc). Drop presence, typing, etc.
        const ALLOWED_TYPES = ['message', 'message_reply', 'event', 'log:subscribe', 'log:unsubscribe', 'log:thread-name', 'log:user-nickname', 'log:thread-admins', 'log:thread-image', 'log:thread-color', 'log:thread-call', 'message_reaction'];
        if (!event.threadID) return; // drop events with no thread (presence, typ, etc.)
        if (event.type && !ALLOWED_TYPES.includes(event.type) && !event.type.startsWith('log:')) return;

        // Wrap event for Marie
        const marieEvent = {
          messageID: event.messageID || '',
          threadID: event.threadID,
          senderID: event.senderID || '',
          body: event.body || "",
          type: event.type,
          timestamp: event.timestamp || Date.now(),
          isGroup: event.isGroup || false,
          mentions: event.mentions || {},
          attachments: event.attachments || [],
          participantIDs: event.participantIDs || [],
          logMessageType: event.logMessageType || null,
          logMessageData: event.logMessageData || null,
          author: event.author || null,
          messageReply: event.messageReply || null,
          senderName: event.senderName || null,
          threadName: event.threadName || null,
        };

        try {
          await brain.processMessage(marieEvent);
        } catch (error) {
          logger.error("Brain process error:", error);
        }
      });

      logger.success(`${config.botName || 'Marie'} is online and listening!`);
    });

  } catch (error) {
    logger.error("Startup error:", error);
    process.exit(1);
  }
}

// Log events
eventBus.on(EVENTS.COMMAND_EXECUTED, ({ command, threadID }) => {
  logger.command(command, "unknown", threadID);
});

// Prevent legacy script errors from crashing the bot
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[UnhandledRejection] A promise was rejected without a catch handler:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[UncaughtException] An unhandled exception occurred:', err.message);
});

start();
