import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

/**
 * Skill Editing: Allows Marie to modify her existing dynamic skills.
 */
export default {
  name: 'edit_skill',
  description: 'Update the logic or description of an existing dynamic skill. Only works on tools created by Marie.',
  schema: z.object({
    name: z.string().describe('The name of the dynamic skill to edit'),
    description: z.string().optional().describe('New description for the skill'),
    logic: z.string().optional().describe('Updated JavaScript code for the handler body')
  }),
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      logic: { type: 'string' }
    },
    required: ['name']
  },
  handler: async ({ name, description, logic }: any, context: any) => {
    const dynamicDir = path.join(process.cwd(), 'marie-skills', 'tools', 'dynamic');
    const filePath = path.join(dynamicDir, `${name}.js`);

    try {
      await fs.access(filePath);
      const existingContent = await fs.readFile(filePath, 'utf-8');

      // 1. Security Scan for new logic
      if (logic) {
        const forbidden = ['process.exit', 'child_process', 'exec(', 'rm ', 'unlink', 'import ', 'require('];
        for (const word of forbidden) {
          if (logic.includes(word)) {
            return { success: false, error: `Security Violation: Forbidden keyword "${word}" found in updated logic.` };
          }
        }
      }

      // 2. Simple Replacement / Update
      // For now, we regenerate the whole file if logic is provided, 
      // or we just update description if it's a simple metadata change.
      // A more sophisticated implementation would use regex to replace specific parts.
      
      let updatedContent = existingContent;
      if (description) {
        updatedContent = updatedContent.replace(/description: '.*',/, `description: '${description.replace(/'/g, "\\'")}',`);
      }
      if (logic) {
        // Find the handler body and replace it
        updatedContent = updatedContent.replace(/handler: async \(params, context\) => \{[\s\S]*\n\s*\}\n\s*\}/, 
          `handler: async (params, context) => {\n    try {\n      ${logic}\n    } catch (error) {\n      return { success: false, error: error.message };\n    }\n  }`);
      }

      await fs.writeFile(filePath, updatedContent, 'utf-8');
      
      if (context.skills && typeof context.skills.hotReload === 'function') {
        await context.skills.hotReload(name, filePath);
      }

      return { success: true, message: `Skill "${name}" updated and reloaded.` };
    } catch (error: any) {
      return { success: false, error: `Failed to edit skill "${name}": ${error.message}` };
    }
  }
};
