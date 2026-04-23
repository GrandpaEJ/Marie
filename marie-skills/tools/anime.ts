import { z } from 'zod';
import { fetch } from 'undici';

export default {
  name: 'anime',
  description: 'Search for anime images by query or category (SFW/NSFW)',
  schema: z.object({
    query: z.string().optional().describe('Search query for specific characters/tags'),
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
  handler: async ({ query, category, isNsfw, amount }: { query?: string, category?: string, isNsfw?: boolean, amount?: number }) => {
    try {
      let url: string;
      
      if (query) {
        // Mode 1: Search by Query (Nekos.best)
        url = `https://nekos.best/api/v2/search?query=${encodeURIComponent(query)}&type=1&amount=${amount || 1}`;
      } else if (category) {
        // Mode 2: Search by Category (Waifu.pics or Nekos.best)
        const type = isNsfw ? 'nsfw' : 'sfw';
        url = `https://api.waifu.pics/${type}/${category}`;
        // Note: Waifu.pics returns a single URL, for multiple we'd need multiple calls or their 'many' endpoint
      } else {
        // Fallback: Random Neko
        url = `https://nekos.best/api/v2/neko?amount=${amount || 1}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data: any = await response.json();
      let results: any[] = [];

      // Unified result mapping
      if (data.results) {
        // Nekos.best format
        results = data.results.map((item: any) => ({
          url: item.url,
          artist: item.artist_name || 'Unknown',
          source: item.source_url || 'Nekos.best'
        }));
      } else if (data.url) {
        // Waifu.pics single result format
        results = [{
          url: data.url,
          artist: 'Unknown',
          source: 'Waifu.pics'
        }];
      }

      return {
        success: true,
        mode: query ? 'search' : 'category',
        category: category || 'general',
        nsfw: isNsfw,
        results
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};
