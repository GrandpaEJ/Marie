import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

/**
 * Self-Debug tool. Allows Marie to analyze her own logs and source code.
 */
export default {
  name: 'self_debug',
  description: 'Analyze system logs and source code to identify bugs or performance issues.',
  schema: z.object({
    focus: z.string().optional().describe('Specific file or error message to focus on'),
    lines: z.number().optional().default(50).describe('Number of log lines to read')
  }),
  parameters: {
    type: 'object',
    properties: {
      focus: { type: 'string' },
      lines: { type: 'number' }
    }
  },
  handler: async ({ focus, lines }: any, context: any) => {
    const logPath = path.join(process.cwd(), 'data', 'logs', 'combined.log');
    
    let analysis = '';

    try {
      // 1. Read Logs
      let logContent = 'Log file not found.';
      try {
        const fullLogs = await fs.readFile(logPath, 'utf-8');
        const logLines = fullLogs.split('\n');
        logContent = logLines.slice(-lines).join('\n');
      } catch (e) {}

      // 2. Read Focus File if provided
      let fileContent = '';
      if (focus && focus.includes('.') && !focus.includes('..')) {
        try {
          fileContent = await fs.readFile(path.join(process.cwd(), focus), 'utf-8');
        } catch (e) {}
      }

      // 3. Perform Analysis (Self-Reflection)
      analysis = `[LOG EXCERPT]\n${logContent}\n\n`;
      if (fileContent) {
        analysis += `[FILE CONTENT: ${focus}]\n${fileContent}\n\n`;
      }

      // 4. Return to Agent for reasoning
      return {
        success: true,
        logs: logContent,
        focused_file: focus || 'none',
        message: 'Logs and source code retrieved. Please analyze and propose a fix using self_improve.'
      };
    } catch (error: any) {
      return { success: false, error: `Self-debug failed: ${error.message}` };
    }
  }
};
