import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
// @ts-ignore
import { vcs } from '../../marie-brain/src/utils/vcs.js';

/**
 * Self-Improvement tool. Allows Marie to modify her own source code.
 */
export default {
  name: 'self_improve',
  description: 'Apply an improvement or fix to a specific source file. Use with caution.',
  category: 'meta',
  riskLevel: 'high',
  schema: z.object({
    target_file: z.string().describe('The path to the file to improve (relative to project root)'),
    instruction: z.string().describe('Clear instruction on what to change or improve')
  }),
  parameters: {
    type: 'object',
    properties: {
      target_file: { type: 'string' },
      instruction: { type: 'string' }
    },
    required: ['target_file', 'instruction']
  },
  handler: async ({ target_file, instruction }: any, context: any) => {
    const filePath = path.join(process.cwd(), target_file);
    
    // 1. Security Check
    const allowedDirs = ['marie-brain', 'marie-skills', 'marie-mem', 'app'];
    const isAllowed = allowedDirs.some(dir => target_file.startsWith(dir));
    const isForbidden = target_file.includes('vcs.js') || target_file.includes('lock.js');
    
    if (!isAllowed || isForbidden) {
      return { success: false, error: `Permission Denied: Modification of "${target_file}" is restricted.` };
    }

    try {
      // 2. Read existing content
      const currentContent = await fs.readFile(filePath, 'utf-8');

      // 3. Request improvement from LLM
      const prompt = `You are a senior software engineer. Improve the following code based on this instruction:
"${instruction}"

Return ONLY the full updated file content. Do not include any explanations or markdown tags.

CODE:
${currentContent}`;

      // In a real scenario, we'd use context.llm.chat()
      // For this implementation, we assume the agent calling the tool 
      // has already "decided" what the new content should be if we want it to be atomic,
      // but the tool protocol in the plan says the tool itself calls the LLM.
      
      if (!context.llm) {
        return { success: false, error: 'LLM context not available for self-improvement.' };
      }

      const response = await context.llm.chat([{ role: 'user', content: prompt }], {
        temperature: 0.1 // Keep it deterministic
      });

      let newContent = response.content.trim();
      // Strip markdown code blocks if the LLM hallucinated them
      newContent = newContent.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '');

      // 4. Checkpoint
      vcs.checkpoint(`pre-improve: ${target_file}`);

      // 5. Apply changes
      await fs.writeFile(filePath, newContent, 'utf-8');

      // 6. Basic Validation (e.g., check for syntax errors)
      // For now, we just check if it's not empty
      if (newContent.length === 0) {
        await vcs.rollback(`pre-improve: ${target_file}`);
        return { success: false, error: 'Self-improvement resulted in empty file. Rollback triggered.' };
      }

      return { 
        success: true, 
        message: `File "${target_file}" improved successfully.`,
        diff_hint: `Check ${vcs.backend === 'git' ? 'git diff' : 'checkpoint logs'} for details.`
      };
    } catch (error: any) {
      return { success: false, error: `Self-improvement failed: ${error.message}` };
    }
  }
};
