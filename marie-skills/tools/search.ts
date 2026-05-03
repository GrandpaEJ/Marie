import { z } from 'zod';

export default {
  name: 'search',
  description: 'Search the web for real-time information, news, and facts.',
  detailedDescription: 'Use this tool when you need information from the internet that is not in your training data, such as recent news, weather, or specific facts about people and events.',
  category: 'data',
  riskLevel: 'low',
  examples: [
    { input: { query: 'weather in Dhaka today' }, explanation: 'Checking local weather' },
    { input: { query: 'latest AI developments May 2026' }, explanation: 'Fetching recent news' }
  ],
  schema: z.object({
    query: z.string().describe('The search query')
  }),
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query to perform' }
    },
    required: ['query']
  },
  handler: async ({ query }: { query: string }) => {
    // Professional mockup for web search
    console.log(`[Skill:Search] Searching the web for: ${query}`);
    return {
      success: true,
      query,
      results: [
        {
          title: `Result for ${query}`,
          link: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `This is a search result for your query about ${query}.`
        }
      ]
    };
  }
};
