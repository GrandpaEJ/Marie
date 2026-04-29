import { z } from 'zod';
declare const _default: {
    name: string;
    description: string;
    schema: z.ZodObject<{
        timezone: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        timezone: string;
    }, {
        timezone?: string | undefined;
    }>;
    parameters: {
        type: string;
        properties: {
            timezone: {
                type: string;
                description: string;
                default: string;
            };
        };
    };
    handler: ({ timezone }: {
        timezone?: string;
    }) => Promise<{
        success: boolean;
        time: string;
        timezone: string;
        note: string;
    }>;
};
export default _default;
