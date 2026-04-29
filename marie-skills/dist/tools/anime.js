import { z } from 'zod';
import { fetch } from 'undici';
export default {
    name: 'anime',
    description: 'Search for anime images (neko, waifu, etc.) by query or category.',
    schema: z.object({
        query: z.string().optional().describe('Search query for specific characters or tags'),
        category: z.enum(['neko', 'waifu', 'husbando', 'kitsune', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe']).optional().describe('Direct category search'),
        isNsfw: z.boolean().optional().default(false).describe('Whether to search in NSFW categories'),
        amount: z.number().max(5).optional().default(1).describe('Number of images to return')
    }),
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query' },
            category: { type: 'string', enum: ['neko', 'waifu', 'husbando', 'kitsune', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'], description: 'Category' },
            isNsfw: { type: 'boolean', description: 'NSFW mode' },
            amount: { type: 'number', description: 'Amount (max 5)' }
        }
    },
    handler: async ({ query, category, isNsfw, amount }) => {
        try {
            const results = [];
            const num = amount || 1;
            // Primary Logic: If query exists, always use nekos.best search
            if (query) {
                const res = await fetch(`https://nekos.best/api/v2/search?query=${encodeURIComponent(query)}&type=1&amount=${num}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.results?.length > 0) {
                        results.push(...data.results.map((item) => ({
                            url: item.url,
                            artist: item.artist_name || 'Unknown',
                            source: item.source_url || 'Nekos.best'
                        })));
                    }
                }
            }
            // Secondary Logic: If no results yet, try by category or random
            if (results.length === 0) {
                const cat = category || 'neko';
                const type = isNsfw ? 'nsfw' : 'sfw';
                // Try nekos.best first for neko/waifu/husbando/kitsune
                const nbSupported = ['neko', 'waifu', 'husbando', 'kitsune'];
                if (nbSupported.includes(cat)) {
                    const res = await fetch(`https://nekos.best/api/v2/${cat}?amount=${num}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.results?.length > 0) {
                            results.push(...data.results.map((item) => ({
                                url: item.url,
                                artist: item.artist_name || 'Unknown',
                                source: item.source_url || 'Nekos.best'
                            })));
                        }
                    }
                }
                // Try waifu.pics as fallback or for other categories
                if (results.length < num) {
                    try {
                        const res = await fetch(`https://api.waifu.pics/${type}/${cat}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.url) {
                                results.push({
                                    url: data.url,
                                    artist: 'Unknown',
                                    source: 'Waifu.pics'
                                });
                            }
                        }
                    }
                    catch (e) { }
                }
            }
            if (results.length === 0) {
                throw new Error("No images found from any provider.");
            }
            return {
                success: true,
                results: results.slice(0, num)
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
};
//# sourceMappingURL=anime.js.map