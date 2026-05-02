#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import login from '@marie/fca';
import { LRUCache } from 'lru-cache';
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
  wrapGoatEvent,
  loadConfig,
  logger,
  userStore,
  threadStore,
  db,
  LLMProvider,
  rbac,
  ensureBinaries,
  verifyIntegrity
} from '@marie/brain';
import { SkillManager } from '@marie/skills';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../../');

async function start() {
  try {
    logger.info("Starting Marie v1...");
    
    // 0. Ensure Native Binaries & Verify Integrity
    await ensureBinaries();
    verifyIntegrity();

    const config = loadConfig();

    // 0. Setup Facebook Compatibility Environment
    setupFBEnvironment({ prefix: config.prefix, admins: config.admins, owner: config.owner });

    // 1. Initialize LLM
    const llm = new LLMProvider(config.openrouter_api_key);
    logger.success("LLM Provider initialized.");

    // 2. Load Commands
    const registry = new CommandRegistry([config.prefix, '/']);
    const eventRegistry = new EventRegistry();


    // 2. Load Shared Commands from Brain
    const sharedCommandsPath = path.join(ROOT_DIR, 'marie-brain/dist/commands');
    if (fs.existsSync(sharedCommandsPath)) {
      await registry.loadCommands(sharedCommandsPath);
    }

    // 2.6 Load Skills
    const skills = new SkillManager();
    const toolsPath = path.join(ROOT_DIR, 'marie-skills/dist/tools');
    await skills.loadTools(toolsPath);

    // 2.7 Sync global.client.commands for legacy script compatibility
    const g = global;
    if (g.client) {
      for (const [name, cmd] of registry.commands.entries()) {
        g.client.commands.set(name, cmd.rawModule || cmd);
      }
    }

    // 3. Setup Storage & Owner
    const enabledPlatforms = config.platforms?.enabled || ['facebook'];

    for (const platformName of enabledPlatforms) {
      if (platformName === 'facebook') {
        logger.info("Initializing Facebook platform...");

        const miraiPath = path.join(ROOT_DIR, 'facebook/src/legacy/mirai');
        if (fs.existsSync(miraiPath)) {
          await registry.loadCommands(miraiPath, wrapMiraiCommand);
          await eventRegistry.loadEvents(miraiPath, wrapMiraiEvent);
        }
        const goatPath = path.join(ROOT_DIR, 'facebook/src/legacy/goat');
        if (fs.existsSync(goatPath)) {
          await registry.loadCommands(goatPath, wrapGoatCommand);
          await eventRegistry.loadEvents(goatPath, wrapGoatEvent);
        }

        let appState;
        const appStatePath = config.platforms?.facebook?.appstate || config.appstate_path;
        const absoluteAppStatePath = path.isAbsolute(appStatePath) ? appStatePath : path.join(ROOT_DIR, appStatePath);

        if (fs.existsSync(absoluteAppStatePath)) {
          appState = JSON.parse(fs.readFileSync(absoluteAppStatePath, 'utf8'));
        } else {
          logger.error(`Facebook appstate not found at ${absoluteAppStatePath}.`);
          continue;
        }

        login({ appState }, async (err, api) => {
          if (err) {
            logger.error("Facebook login failed:", err);
            return;
          }
          logger.success("Connected to Facebook.");
          const platform = new FBPlatform(api);
          await setupBrain(platform, registry, eventRegistry, llm, config, skills);

          if (api && typeof api.setOptions === 'function') {
            api.setOptions(config.fca_options || { listenEvents: true, selfListen: false, logLevel: "silent" });
          }
          api.listenMqtt(async (err, event) => {
            if (err) return logger.error("FB Mqtt error:", err);
            if (!event.threadID) return;
            const ALLOWED_TYPES = ['message', 'message_reply', 'event', 'log:subscribe', 'log:unsubscribe', 'log:thread-name', 'log:user-nickname', 'log:thread-admins', 'log:thread-image', 'log:thread-color', 'log:thread-call', 'message_reaction'];
            if (event.type && !ALLOWED_TYPES.includes(event.type) && !event.type.startsWith('log:')) return;

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
            eventBus.emit('marie:event', { platform, event: marieEvent });
          });
        });
      }

      if (platformName === 'telegram') {
        logger.info("Initializing Telegram platform...");

        // Load Telegram Specific Commands
        const tgCommandsPath = path.join(ROOT_DIR, 'telegram/dist/commands');
        if (fs.existsSync(tgCommandsPath)) {
          await registry.loadCommands(tgCommandsPath);
        }

        const tgConfig = config.platforms?.telegram;
        const botToken = tgConfig?.token || process.env.TELEGRAM_BOT_TOKEN;

        if (!botToken) {
          logger.error("Telegram token not found in config or .env.");
          continue;
        }

        const { createTGPlatform, Dispatcher, filters } = await import('@marie/tg');

        // Ensure session directory exists
        const sessionPath = path.join(ROOT_DIR, './data/tg-session');
        const sessionDir = path.dirname(sessionPath);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const platform = await createTGPlatform({
          apiId: tgConfig.apiId || parseInt(process.env.TELEGRAM_API_ID || '0'),
          apiHash: tgConfig.apiHash || process.env.TELEGRAM_API_HASH || '',
          storage: sessionPath
        });

        const brain = await setupBrain(platform, registry, eventRegistry, llm, config, skills);

        // Telegram specific update handling
        const dp = Dispatcher.for(platform.client);
        dp.onNewMessage(async (msg) => {
          logger.info(`[Telegram] New message from ${msg.sender.id}: ${msg.text}`);
          const { TGPlatform } = await import('@marie/tg');
          const marieEvent = TGPlatform.toMarieEvent(msg);
          await brain.processMessage(marieEvent);
        });

        await platform.client.start({
          botToken: tgConfig.token || process.env.TELEGRAM_BOT_TOKEN
        });

        logger.success("Connected to Telegram.");
      }
    }

    async function setupBrain(platform, registry, eventRegistry, llm, config, skills) {
      // Platform-specific overrides for owner and admins
      const platformConfig = { ...config };
      const overrides = config.platforms?.[platform.name];
      if (overrides?.owner) platformConfig.owner = overrides.owner;
      if (overrides?.admins) platformConfig.admins = overrides.admins;

      // Ensure platform-specific owner is registered
      userStore.ensureOwner(platformConfig.owner, `${platform.name.charAt(0).toUpperCase() + platform.name.slice(1)} Owner`);

      const brain = new Brain(platform, registry, llm, platformConfig, {
        userStore,
        threadStore,
        db,
        skills,
        eventRegistry
      });

      const processedMessages = new LRUCache({ max: 500 });
      brain.use(async (ctx, next) => {
        const msgID = ctx.event.messageID;
        if (processedMessages.has(msgID)) return;
        processedMessages.set(msgID, true);
        await next();
      });

      brain.use(brain.builtins.userFetcher);
      brain.use(rbac(userStore));
      brain.use(brain.builtins.globalMode);
      brain.use(brain.builtins.eventHooks);
      brain.use(brain.builtins.commandRouter);
      brain.use(brain.builtins.fallbackChat);

      if (platform.name === 'facebook') {
        eventBus.on('marie:event', async ({ platform: p, event }) => {
          if (p === platform) await brain.processMessage(event);
        });
      }

      return brain;
    }

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
