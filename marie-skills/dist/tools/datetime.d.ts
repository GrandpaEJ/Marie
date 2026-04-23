import { z } from 'zod';
declare const _default: {
    name: string;
    description: string;
    schema: z.ZodObject<{
        timezone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timezone?: string | undefined;
    }, {
        timezone?: string | undefined;
    }>;
    parameters: {
        type: string;
        properties: {
            timezone: {
                type: string;
                description: string;
            };
        };
    };
    handler: ({ timezone }: {
        timezone?: string;
    }) => Promise<{
        success: boolean;
        timestamp: string;
        formatted: string;
        timezone: string;
    }>;
};
export default _default;
