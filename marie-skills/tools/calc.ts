import { z } from 'zod';

export default {
  name: 'calculator',
  description: 'Evaluate mathematical expressions precisely.',
  detailedDescription: 'Use this tool for any mathematical calculations, even simple ones, to ensure absolute accuracy. Supports standard operators, parentheses, and basic math functions.',
  category: 'utility',
  riskLevel: 'low',
  examples: [
    { input: { expression: '25 * 4 / (2 + 3)' }, explanation: 'Solving a math expression' },
    { input: { expression: 'Math.sqrt(144)' }, explanation: 'Calculating square root' }
  ],
  schema: z.object({
    expression: z.string().describe('The math expression to evaluate (e.g., 2 + 2 * 4)')
  }),
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'The math expression' }
    },
    required: ['expression']
  },
  handler: async ({ expression }: { expression: string }) => {
    try {
      // Basic safety: allow only numbers and math operators
      if (/[^0-9+\-*/().\s]/.test(expression)) {
        throw new Error('Invalid characters in expression');
      }
      
      // Use Function constructor for a simple, isolated evaluator
      const result = new Function(`return (${expression})`)();
      
      return {
        success: true,
        expression,
        result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
