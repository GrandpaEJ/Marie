import animeService from '../services/anime-api.js';
import { getReadableStream } from '../services/image-proxy.js';
import { getThread } from '../storage/thread-store.js';
export default {
    name: 'anime',
    aliases: ['waifu', 'neko'],
    description: 'Get random anime images',
    commandCategory: 'media',
    usage: '.anime [type] [category]',
    minRole: 'user',
    handler: async (ctx) => {
        const { api, event, args, user, config } = ctx;
        const { threadID, body } = event;
        // Handle shortcuts
        let type = 'sfw';
        let category = 'waifu';
        const trigger = body.split(/\s+/)[0].slice(config.prefix.length).toLowerCase();
        if (trigger === 'waifu')
            category = 'waifu';
        if (trigger === 'neko')
            category = 'neko';
        // Parse args if using full .anime command
        if (trigger === 'anime') {
            if (args[0] === 'nsfw')
                type = 'nsfw';
            if (args[1])
                category = args[1];
        }
        // NSFW Check
        if (type === 'nsfw') {
            const thread = getThread(threadID);
            const globalNsfw = config.anime?.nsfwAllowed;
            const threadNsfw = thread.nsfw;
            if (!globalNsfw || !threadNsfw) {
                return api.sendMessage("[Marie] NSFW content is not enabled for this thread or globally.", threadID);
            }
        }
        api.sendMessage(`[Marie] Fetching your ${type} ${category} image...`, threadID);
        try {
            const { url, source } = await animeService.getImage(type, category);
            const stream = await getReadableStream(url);
            await api.sendMessage({
                body: `[Marie] Source: ${source}`,
                attachment: [stream]
            }, threadID);
        }
        catch (error) {
            console.error("Anime command error:", error);
            api.sendMessage(`[Marie] Error: ${error.message}`, threadID);
        }
    }
};
