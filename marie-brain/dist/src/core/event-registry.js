import fg from 'fast-glob';
export class EventRegistry {
    hooks = [];
    constructor() { }
    register(hook) {
        this.hooks.push(hook);
    }
    async loadEvents(dirPath, wrapper) {
        const files = await fg('**/*.js', { cwd: dirPath, absolute: true });
        for (const file of files) {
            try {
                const module = await import(`file://${file}`);
                const rawHook = module.default || module;
                const finalHook = wrapper ? wrapper(rawHook) : rawHook;
                if (typeof finalHook === 'function') {
                    this.register(finalHook);
                }
            }
            catch (error) {
                console.error(`[EventRegistry] Failed to load event from ${file}:`, error);
            }
        }
    }
    async executeAll(ctx) {
        for (const hook of this.hooks) {
            try {
                await hook(ctx);
            }
            catch (error) {
                console.error(`[EventRegistry] Error in hook:`, error);
            }
        }
    }
}
