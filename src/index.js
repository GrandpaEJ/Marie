#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import login from '@marie/fca';
import { loadConfig } from './utils/config.js';
import logger from './utils/logger.js';
import { LLMProvider } from '@marie/llm';
import { Brain, CommandRegistry, eventBus, EVENTS } from '@marie/brain';
import { SkillManager } from '@marie/skills';
import * as userStore from './storage/user-store.js';
import * as threadStore from './storage/thread-store.js';
import db from './storage/db.js';

async function start() {
  try {
    logger.info("Starting Marie v1...");
    const config = loadConfig();
    
    // 1. Initialize LLM
    const llm = new LLMProvider(config.openrouter_api_key);
    logger.success("LLM Provider initialized.");

    // 2. Load Commands & Skills
    const registry = new CommandRegistry(config.prefix);
    const commandsPath = path.join(process.cwd(), 'src/commands');
    await registry.loadCommands(commandsPath);

    const skills = new SkillManager();
    const toolsPath = path.join(process.cwd(), 'marie-skills/dist/tools');
    await skills.loadTools(toolsPath);

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
      const brain = new Brain(api, registry, llm, config, {
        userStore,
        threadStore,
        db,
        skills
      });

      // --- 6. Assemble Middleware Pipeline ---
      
      // 6a. Custom Deduplication Middleware
      const processedMessages = new Set();
      brain.use(async (ctx, next) => {
        const { event } = ctx;
        if (processedMessages.has(event.messageID)) return;
        
        processedMessages.add(event.messageID);
        if (processedMessages.size > 100) {
          const first = processedMessages.values().next().value;
          processedMessages.delete(first);
        }
        await next();
      });

      // 6b. Core Engine Middlewares
      brain
        .use(brain.builtins.userFetcher)
        .use(brain.builtins.globalMode)
        .use(brain.builtins.commandRouter)
        .use(brain.builtins.fallbackChat);

      // 7. Start Listening
      api.listenMqtt(async (err, event) => {
        if (err) {
          logger.error("Listen error:", err);
          return;
        }

        if (event.type === "message" || event.type === "message_reply") {
          await brain.processMessage(event);
        }
      });

      logger.success(`${config.botName} is online!`);
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

start();
