import { z } from 'zod';
import dns from 'dns/promises';

/**
 * Network Lookup tool. DNS resolution and basic connectivity checks.
 */
export default {
  name: 'net_lookup',
  description: 'Perform DNS lookups and resolve hostnames to IP addresses.',
  schema: z.object({
    hostname: z.string().describe('The hostname to resolve (e.g., google.com)')
  }),
  parameters: {
    type: 'object',
    properties: {
      hostname: { type: 'string' }
    },
    required: ['hostname']
  },
  handler: async ({ hostname }: any) => {
    try {
      const addresses = await dns.resolve4(hostname);
      const mx = await dns.resolveMx(hostname).catch(() => []);
      
      return {
        success: true,
        hostname,
        ipv4: addresses,
        mx: mx.map(m => `${m.exchange} (priority ${m.priority})`)
      };
    } catch (error: any) {
      return { success: false, error: `Lookup failed: ${error.message}` };
    }
  }
};
