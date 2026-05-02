import { updateThread, getThread } from '../storage/thread-store.js';
export default {
    name: 'model',
    description: 'Manage LLM model for this thread',
    commandCategory: 'ai',
    usage: '.model list | .model set <name> | .model info',
    minRole: 'admin',
    handler: async (ctx) => {
        const { api, event, args, llm, config } = ctx;
        const { threadID } = event;
        if (!args[0]) {
            return api.sendMessage(`[Marie] Usage: ${config.prefix}model list | set <name> | info`, threadID);
        }
        const sub = args[0].toLowerCase();
        if (sub === 'list') {
            api.sendMessage("[Marie] Fetching model list from OpenRouter...", threadID);
            const models = await llm.listModels();
            const freeModels = models
                .filter(m => m.id.endsWith(':free'))
                .map(m => m.id)
                .slice(0, 15);
            let msg = "[ Marie Free Models ]\n\n";
            msg += freeModels.join('\n');
            msg += "\n\nUse .model set <id> to switch.";
            return api.sendMessage(msg, threadID);
        }
        if (sub === 'info') {
            const thread = getThread(threadID);
            const currentModel = thread.model || config.llm.defaultModel;
            return api.sendMessage(`[Marie] Current Model: ${currentModel}`, threadID);
        }
        if (sub === 'set') {
            const modelName = args[1];
            if (!modelName)
                return api.sendMessage("[Marie] Please specify a model ID.", threadID);
            updateThread(threadID, { model: modelName });
            return api.sendMessage(`[Marie] Model updated to: ${modelName}`, threadID);
        }
    }
};
