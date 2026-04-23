import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
class LLMProvider {
    constructor(apiKey, baseUrl = OPENROUTER_BASE_URL) {
        if (!apiKey) {
            throw new Error('OPENROUTER_API_KEY is required');
        }
        this.client = new OpenAI({
            apiKey,
            baseURL: baseUrl,
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/GrandpaEJ/marie', // Optional
                'X-Title': 'Marie AI Agent'
            }
        });
    }
    async chat(messages, options = {}) {
        try {
            const response = await this.client.chat.completions.create({
                model: options.model || 'google/gemma-3-8b-it:free',
                messages: messages,
                temperature: options.temperature ?? 0.85,
                max_tokens: options.max_tokens ?? 1024,
                stream: false
            });
            return {
                content: response.choices[0].message.content,
                usage: response.usage, // { prompt_tokens, completion_tokens, total_tokens }
                model: response.model
            };
        }
        catch (error) {
            console.error('OpenRouter API Error:', error.message);
            throw error;
        }
    }
    async listModels() {
        try {
            const response = await fetch(`${OPENROUTER_BASE_URL}/models`);
            const data = await response.json();
            return data.data; // List of model objects
        }
        catch (error) {
            console.error('Failed to list models:', error.message);
            return [];
        }
    }
}
// Singleton instance
let instance = null;
export function getLLMProvider(apiKey) {
    if (!instance && apiKey) {
        instance = new LLMProvider(apiKey);
    }
    return instance;
}
export default LLMProvider;
//# sourceMappingURL=provider.js.map