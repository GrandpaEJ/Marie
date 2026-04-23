/**
 * Marie-LLM: 0-Dependency, High-Performance LLM SDK
 * Built with TypeScript and native Fetch.
 */
export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
}
export interface ChatOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}
export interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare class LLMProvider {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string, baseUrl?: string);
    /**
     * Universal Chat Completion
     */
    chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse>;
}
