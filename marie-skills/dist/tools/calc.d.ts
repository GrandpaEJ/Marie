import { z } from 'zod';
declare const _default: {
    name: string;
    description: string;
    schema: z.ZodObject<{
        expression: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        expression: string;
    }, {
        expression: string;
    }>;
    parameters: {
        type: string;
        properties: {
            expression: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: ({ expression }: {
        expression: string;
    }) => Promise<{
        success: boolean;
        expression: string;
        result: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        expression?: undefined;
        result?: undefined;
    }>;
};
export default _default;
