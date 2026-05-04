import { z } from 'zod';

/**
 * Reminder tool. Sends a message after a delay.
 */
export default {
  name: 'remind',
  description: 'Schedule a reminder for later. Currently supports delays up to 24 hours.',
  schema: z.object({
    message: z.string().describe('The reminder message'),
    delay_minutes: z.number().min(1).max(1440).describe('Delay in minutes')
  }),
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      delay_minutes: { type: 'number' }
    },
    required: ['message', 'delay_minutes']
  },
  handler: async ({ message, delay_minutes }: any, context: any) => {
    const delayMs = delay_minutes * 60 * 1000;
    const { threadID, senderID } = context;

    // Use a background timer
    setTimeout(async () => {
      try {
        if (context.api && typeof context.api.sendMessage === 'function') {
          await context.api.sendMessage(`⏰ **REMINDER**: ${message}`, threadID);
        }
      } catch (e) {
        console.error('[Skill:Remind] Failed to send reminder:', e);
      }
    }, delayMs);

    return {
      success: true,
      message: `Reminder set for ${delay_minutes} minutes from now.`,
      scheduled_time: new Date(Date.now() + delayMs).toISOString()
    };
  }
};
