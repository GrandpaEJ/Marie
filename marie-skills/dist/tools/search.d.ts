import { z } from 'zod';
declare const _default: {
    name: string;
    description: string;
    schema: z.ZodObject<{
        query: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        query: string;
    }, {
        query: string;
    }>;
    parameters: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: ({ query }: {
        query: string;
    }) => Promise<{
        success: boolean;
        query: string;
        results: {
            title: string;
            link: string;
            snippet: string;
        }[];
    }>;
};
export default _default;
