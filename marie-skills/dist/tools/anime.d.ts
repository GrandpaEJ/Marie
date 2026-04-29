import { z } from 'zod';
declare const _default: {
    name: string;
    description: string;
    schema: z.ZodObject<{
        query: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<["neko", "waifu", "husbando", "kitsune", "shinobu", "megumin", "bully", "cuddle", "cry", "hug", "awoo", "kiss", "lick", "pat", "smug", "bonk", "yeet", "blush", "smile", "wave", "highfive", "handhold", "nom", "bite", "glomp", "slap", "kill", "kick", "happy", "wink", "poke", "dance", "cringe"]>>;
        isNsfw: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        amount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        isNsfw: boolean;
        amount: number;
        query?: string | undefined;
        category?: "neko" | "waifu" | "husbando" | "kitsune" | "shinobu" | "megumin" | "bully" | "cuddle" | "cry" | "hug" | "awoo" | "kiss" | "lick" | "pat" | "smug" | "bonk" | "yeet" | "blush" | "smile" | "wave" | "highfive" | "handhold" | "nom" | "bite" | "glomp" | "slap" | "kill" | "kick" | "happy" | "wink" | "poke" | "dance" | "cringe" | undefined;
    }, {
        query?: string | undefined;
        category?: "neko" | "waifu" | "husbando" | "kitsune" | "shinobu" | "megumin" | "bully" | "cuddle" | "cry" | "hug" | "awoo" | "kiss" | "lick" | "pat" | "smug" | "bonk" | "yeet" | "blush" | "smile" | "wave" | "highfive" | "handhold" | "nom" | "bite" | "glomp" | "slap" | "kill" | "kick" | "happy" | "wink" | "poke" | "dance" | "cringe" | undefined;
        isNsfw?: boolean | undefined;
        amount?: number | undefined;
    }>;
    parameters: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            category: {
                type: string;
                enum: string[];
                description: string;
            };
            isNsfw: {
                type: string;
                description: string;
            };
            amount: {
                type: string;
                description: string;
            };
        };
    };
    handler: ({ query, category, isNsfw, amount }: {
        query?: string;
        category?: string;
        isNsfw?: boolean;
        amount?: number;
    }) => Promise<{
        success: boolean;
        results: any[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        results?: undefined;
    }>;
};
export default _default;
