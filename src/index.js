#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import login from 'stfca';
import { loadConfig } from './utils/config.js';
import logger from './utils/logger.js';
import CommandRegistry from './core/command-registry.js';
import { getLLMProvider } from './llm/provider.js';
import Brain from './core/brain.js';
import { ensureOwner } from './storage/user-store.js';
import eventBus, { EVENTS } from './core/event-bus.js';

async function start() {
  try {
    // 1. Load Config
    logger.info("Starting Marie v1...");
    const config = loadConfig();
    
    // 2. Initialize LLM
    const llm = getLLMProvider(config.openrouter_api_key);
    logger.success("LLM Provider initialized.");

    // 3. Load Commands
    const registry = new CommandRegistry(config.prefix);
    await registry.loadCommands();

    // 4. Login to Facebook
    let appState;
    if (fs.existsSync(config.appstate_path)) {
      appState = JSON.parse(fs.readFileSync(config.appstate_path, 'utf8'));
    } else {
      logger.error(`Appstate not found at ${config.appstate_path}. Please create it.`);
      process.exit(1);
    }

    login({ appState }, async (err, api) => {
      if (err) {
        logger.error("Login failed:", err);
        return;
      }

      logger.success("Connected to Facebook.");

      // 5. Setup Storage & Owner
      ensureOwner(config.owner, "Bot Owner");

      // 6. Initialize Brain
      const brain = new Brain(api, registry, llm, config);

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

      logger.success(`${config.botName} is online and listening!`);
    });

  } catch (error) {
    logger.error("Startup error:", error);
    process.exit(1);
  }
}

// Handle events for logging
eventBus.on(EVENTS.COMMAND_EXECUTED, ({ command, threadID }) => {
  logger.command(command, "unknown", threadID);
});

start();
