import { IMarieContext } from '../types.js';
import fg from 'fast-glob';

export type MarieEventHook = (ctx: IMarieContext) => Promise<void>;

export class EventRegistry {
  private hooks: MarieEventHook[] = [];

  constructor() {}

  register(hook: MarieEventHook) {
    this.hooks.push(hook);
  }

  async loadEvents(dirPath: string, wrapper?: (mod: any) => MarieEventHook | null) {
    const files = await fg('**/*.js', { cwd: dirPath, absolute: true });
    for (const file of files) {
      try {
        const module = await import(`file://${file}`);
        const rawHook = module.default || module;
        const finalHook = wrapper ? wrapper(rawHook) : rawHook;
        
        if (finalHook === null || finalHook === undefined) continue; // skip command-only scripts
        if (typeof finalHook === 'function') {
          this.register(finalHook);
        }
      } catch (error) {
        console.error(`[EventRegistry] Failed to load event from ${file}:`, error);
      }
    }
  }

  async executeAll(ctx: IMarieContext) {
    for (const hook of this.hooks) {
      try {
        await hook(ctx);
      } catch (error) {
        console.error(`[EventRegistry] Error in hook:`, error);
      }
    }
  }
}

