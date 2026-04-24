/**
 * Marie-LLM: Ultra-High-Performance, 0-Dependency LLM SDK
 * Optimized with Undici Pool, Request, Caching, and Exponential Backoff.
 */
export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_calls?: any[];
    tool_call_id?: string;
}
export interface ChatOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: any[];
    tool_choice?: string | object;
}
export interface LLMResponse {
    content: string;
    model: string;
    toolCalls?: any[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare class LLMProvider {
    private apiKey;
    private pool;
    private basePath;
    private cache;
    private readonly cacheTTL;
    constructor(apiKey: string, baseUrl?: string);
    /**
     * Universal Chat Completion with Caching and Retry logic
     */
    chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse>;
    /**
     * Internal fetch with exponential backoff
     */
    private fetchWithRetry;
    /**
     * Final safety fallback using native global fetch
     */
    private nativeFallback;
    private getCacheKey;
    destroy(): Promise<void>;
}
