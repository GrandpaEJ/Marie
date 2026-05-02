import { IMarieContext, IMarieEvent, IPlatform, IMarieUser, MarieMiddleware, ICommand } from './types.js';
import { Brain, verifyIntegrity } from './core/brain.js';
import { EventRegistry } from './core/event-registry.js';
import { CommandRegistry } from './core/command-registry.js';
import { FBPlatform } from './fb/facebook.js';
import { wrapMiraiCommand, wrapMiraiEvent } from './fb/mirai.js';
import { wrapGoatCommand, wrapGoatEvent } from './fb/goat.js';
import { loadMirai, loadGoat } from './fb/loader.js';
import { initGlobalMocks as setupFBEnvironment } from './fb/fallback.js';
import eventBus, { EVENTS } from './core/event-bus.js';

export {
  Brain,
  verifyIntegrity,
  EventRegistry,
  CommandRegistry,
  FBPlatform,
  wrapMiraiCommand,
  wrapMiraiEvent,
  wrapGoatCommand,
  wrapGoatEvent,
  loadMirai,
  loadGoat,
  setupFBEnvironment,
  eventBus,

  EVENTS,
  IMarieContext,
  IMarieEvent,
  IPlatform,
  IMarieUser,
  MarieMiddleware,
  ICommand
};

export * as userStore from './storage/user-store.js';
export * as threadStore from './storage/thread-store.js';
export { default as db } from './storage/db.js';
export { loadConfig } from './utils/config.js';
export { default as logger } from './utils/logger.js';
export { default as rbac } from './middlewares/rbac.js';
export { LLMProvider } from '@marie/llm';
export { ensureBinaries } from './utils/binaries.js';
