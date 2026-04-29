import { z } from 'zod';
export default {
    name: 'datetime',
    description: 'Get the current date and time. Use this when the user asks for the current time or date.',
    schema: z.object({
        timezone: z.string().optional().default('Asia/Dhaka').describe('Timezone (e.g., Asia/Dhaka, UTC)')
    }),
    parameters: {
        type: 'object',
        properties: {
            timezone: { type: 'string', description: 'Timezone', default: 'Asia/Dhaka' }
        }
    },
    handler: async ({ timezone }) => {
        const tz = timezone || 'Asia/Dhaka';
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: tz,
            timeZoneName: 'short'
        };
        const formatted = new Intl.DateTimeFormat('en-US', options).format(now);
        return {
            success: true,
            time: formatted,
            timezone: tz,
            note: tz === 'Asia/Dhaka' ? "This is the user's local time." : ""
        };
    }
};
//# sourceMappingURL=datetime.js.map