import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export default {
  name: 'delete_skill',
  description: 'Remove a dynamic skill created by Marie. Only works on dynamic skills.',
  schema: z.object({
    name: z.string().describe('The name of the skill to delete')
  }),
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    },
    required: ['name']
  },
  handler: async ({ name }: { name: string }, context: any) => {
    const dynamicDir = path.join(process.cwd(), 'marie-skills', 'tools', 'dynamic');
    const filePath = path.join(dynamicDir, `${name}.js`);

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      
      if (context.skills && typeof context.skills.unregister === 'function') {
        context.skills.unregister(name);
      }

      return { success: true, message: `Skill "${name}" deleted successfully.` };
    } catch (error: any) {
      return { success: false, error: `Skill "${name}" not found or cannot be deleted.` };
    }
  }
};
