import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export default {
  name: 'list_skills',
  description: 'List all currently available skills and their source (static or dynamic).',
  schema: z.object({}),
  parameters: {
    type: 'object',
    properties: {}
  },
  handler: async ({}: any, context: any) => {
    const staticDir = path.join(process.cwd(), 'marie-skills', 'tools');
    const dynamicDir = path.join(process.cwd(), 'marie-skills', 'tools', 'dynamic');

    try {
      const staticFiles = (await fs.readdir(staticDir)).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
      const dynamicFiles = (await fs.readdir(dynamicDir)).filter(f => f.endsWith('.ts') || f.endsWith('.js') && !f.startsWith('.'));

      return {
        success: true,
        static_skills: staticFiles.map(f => f.replace(/\.(ts|js)$/, '')),
        dynamic_skills: dynamicFiles.map(f => f.replace(/\.(ts|js)$/, ''))
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};
