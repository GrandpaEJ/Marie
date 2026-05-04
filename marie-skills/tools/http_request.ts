import { z } from 'zod';

/**
 * HTTP Request tool. Fetches JSON data from external APIs.
 */
export default {
  name: 'http_request',
  description: 'Fetch JSON data from a URL. Only allowed domains can be reached.',
  schema: z.object({
    url: z.string().url().describe('The URL to fetch'),
    method: z.enum(['GET', 'POST']).optional().default('GET')
  }),
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      method: { type: 'string', enum: ['GET', 'POST'] }
    },
    required: ['url']
  },
  handler: async ({ url, method }: any, context: any) => {
    // 1. Whitelist Check
    const whitelist = context.config?.tools?.httpWhitelist || ['api.github.com', 'jsonplaceholder.typicode.com', 'api.themoviedb.org'];
    const parsedUrl = new URL(url);
    
    if (!whitelist.includes(parsedUrl.hostname)) {
      return { 
        success: false, 
        error: `Permission Denied: Domain "${parsedUrl.hostname}" is not in the whitelist.`,
        whitelist
      };
    }

    try {
      const response = await fetch(url, { method });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      return {
        success: true,
        status: response.status,
        data
      };
    } catch (error: any) {
      return { success: false, error: `Request failed: ${error.message}` };
    }
  }
};
