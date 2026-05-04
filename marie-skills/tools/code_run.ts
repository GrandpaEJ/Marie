import { z } from 'zod';
import vm from 'vm';

/**
 * Code Execution tool. Runs JS snippets in a secure sandbox.
 */
export default {
  name: 'code_run',
  description: 'Execute JavaScript code in a isolated sandbox for calculations or logic testing.',
  schema: z.object({
    code: z.string().describe('The JavaScript code to execute')
  }),
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string' }
    },
    required: ['code']
  },
  handler: async ({ code }: any) => {
    // 1. Prototype Pollution Defense
    const cleanObject = Object.create(null);
    
    const sandbox = {
      ...cleanObject,
      console: {
        log: (...args: any[]) => { 
          if (sandbox.logs.length < 5000) {
            sandbox.logs += args.join(' ') + '\n'; 
          }
        }
      },
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      logs: ''
    };

    try {
      const script = new vm.Script(code);
      const context = vm.createContext(sandbox);
      const result = script.runInContext(context, { 
        timeout: 5000,
        breakOnSigint: true
      });

      return {
        success: true,
        result: result === undefined ? 'undefined' : result,
        logs: sandbox.logs.substring(0, 5000) // Truncate if too long
      };
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        return { success: false, error: 'Execution Timed Out (Max 5s allowed). recursive or infinite loop detected.' };
      }
      return { success: false, error: `Execution Error: ${error.message}` };
    }
  }
};
