import { z } from 'zod';
declare const _default: {
    name: string;
    description: string;
    schema: z.ZodObject<{
        query: z.ZodString;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        limit: number;
    }, {
        query: string;
        limit?: number | undefined;
    }>;
    parameters: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: ({ query, limit }: {
        query: string;
        limit?: number;
    }) => Promise<{
        success: boolean;
        query: string;
        results: {
            title: string;
            image: string;
            description: string;
        }[];
    }>;
};
export default _default;
