import { z } from 'zod';
export default {
    name: 'datetime',
    description: 'Get the current date and time in various formats',
    schema: z.object({
        timezone: z.string().optional().describe('Optional timezone (e.g., UTC, Asia/Dhaka)')
    }),
    parameters: {
        type: 'object',
        properties: {
            timezone: { type: 'string', description: 'Optional timezone' }
        }
    },
    handler: async ({ timezone }) => {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: timezone || 'UTC',
            timeZoneName: 'short'
        };
        const formatted = new Intl.DateTimeFormat('en-US', options).format(now);
        return {
            success: true,
            timestamp: now.toISOString(),
            formatted,
            timezone: timezone || 'UTC'
        };
    }
};
//# sourceMappingURL=datetime.js.map