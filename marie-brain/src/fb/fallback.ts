import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

/**
 * Provides a safe version of fs that prevents crashes on common errors.
 */
export const safeFs = new Proxy(fs, {
  get(target, prop) {
    const original = (target as any)[prop];
    if (typeof original === 'function') {
      return (...args: any[]) => {
        try {
          return original(...args);
        } catch (error) {
          console.error(`[FS-Fallback] Error in fs.${String(prop)}:`, error);
          return null;
        }
      };
    }
    return original;
  }
});

/**
 * Global mocks for legacy bot compatibility.
 */
export function initGlobalMocks(config?: { prefix?: string; admins?: string[]; owner?: string }) {
  const g = global as any;

  if (!g.fs) g.fs = safeFs;
  if (!g.path) g.path = path;

  // Global nodemodule map — legacy Mirai scripts use global.nodemodule["fs-extra"] etc.
  if (!g.nodemodule) {
    // Pre-populate built-in and common modules directly
    const preloaded: Record<string, any> = {
      'path': path,
      'fs': fs,
    };
    const moduleAliases: Record<string, string> = {
      'fs-extra': 'fs-extra',
      'axios': 'axios',
      'request': 'request',
      'moment': 'moment',
      'moment-timezone': 'moment-timezone',
      'jimp': 'jimp',
      'canvas': 'canvas',
      'sharp': 'sharp',
      'form-data': 'form-data',
      'cheerio': 'cheerio',
      'undici': 'undici',
    };
    // Eagerly load what we can
    for (const [alias, pkg] of Object.entries(moduleAliases)) {
      try { preloaded[alias] = _require(pkg); } catch { /* optional */ }
    }

    g.nodemodule = new Proxy(preloaded, {
      get(target, prop: string) {
        if (target[prop] !== undefined) return target[prop];
        try {
          target[prop] = _require(prop as string);
          return target[prop];
        } catch {
          console.warn(`[NodeModule-Fallback] Module "${String(prop)}" not found, returning stub.`);
          target[prop] = {};
          return target[prop];
        }
      }
    });
  }

  // Global moduleData — legacy scripts store per-module state here
  if (!g.moduleData) {
    g.moduleData = new Proxy({} as Record<string, any>, {
      get(target, prop: string) {
        if (!target[prop]) target[prop] = {};
        return target[prop];
      }
    });
  }

  // Global config mock for legacy scripts that expect global.config.PREFIX etc.
  if (!g.config) {
    g.config = {
      PREFIX: config?.prefix || '/',
      ADMIN: config?.admins || [],
      OWNER_ID: config?.owner ? [config.owner] : [],
      SELFMODE: false,
    };
  } else {
    // Update PREFIX if config provides it
    if (config?.prefix) g.config.PREFIX = config.prefix;
  }

  // Mock common dependencies if not present
  if (!g.axios) {
    try { g.axios = require('axios'); } catch {
      g.axios = {
        get: async () => ({ data: {} }),
        post: async () => ({ data: {} })
      };
    }
  }

  // Ensure client/data exist for Mirai
  if (!g.client) {
    g.client = {
      commands: new Map(),
      events: new Map(),
      aliases: new Map(),
      cooldowns: new Map(),
      mainPath: process.cwd(),
      configPath: "",
      getTime: () => Date.now()
    };
  }

  if (!g.data) {
    g.data = {
      threadData: new Map(),
      threadInfo: new Map(),
      userName: new Map(),
      userBanned: new Map(),
      threadBanned: new Map(),
      commandBanned: new Map(),
      threadAllowNSFW: [],
      allUserID: [],
      allCurrenciesID: [],
      allThreadID: []
    };
  }

  // Font registration fallback for legacy scripts
  // pnpm aliases 'canvas' -> '@napi-rs/canvas', so require('canvas') already works.
  try {
    const canvasModule = _require('canvas');
    if (!g.canvas) g.canvas = canvasModule;

    const registerFont =
      canvasModule.registerFont ||
      (canvasModule.GlobalFonts
        ? (fontPath: string, options: { family: string }) =>
            canvasModule.GlobalFonts.registerFromPath(fontPath, options.family)
        : null);

    if (registerFont) {
      if (!g.canvas.registerFont) g.canvas.registerFont = registerFont;
      if (!g.registerFont) g.registerFont = registerFont;
    }

    // Pre-populate nodemodule canvas entry
    if (g.nodemodule && !g.nodemodule['canvas']) {
      g.nodemodule['canvas'] = canvasModule;
    }
  } catch (e) {
    // canvas not available
  }
}
