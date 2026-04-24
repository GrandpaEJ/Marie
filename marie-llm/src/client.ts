/**
 * Marie-LLM: Ultra-High-Performance, 0-Dependency LLM SDK
 * Optimized with Undici Pool, Request, Caching, and Exponential Backoff.
 */

import { Pool } from 'undici';
import { createHash } from 'crypto';

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

export class LLMProvider {
  private pool: Pool;
  private basePath: string;
  private cache = new Map<string, { data: LLMResponse; timestamp: number }>();
  private readonly cacheTTL = 60_000; // 60 seconds

  constructor(
    private apiKey: string, 
    baseUrl: string = 'https://openrouter.ai/api/v1'
  ) {
    // Parse URL to separate origin and path
    const url = new URL(baseUrl);
    const origin = url.origin;
    this.basePath = url.pathname;

    // Connection pool for maximum throughput
    this.pool = new Pool(origin, {
      connections: 20,           // Concurrent connections
      pipelining: 10,            // Pipeline requests per connection
      keepAliveTimeout: 30_000,  // Keep alive for 30s
      headersTimeout: 60_000,    // 60s timeout for LLM responses
      bodyTimeout: 60_000        // 60s timeout for body
    });
  }

  /**
   * Universal Chat Completion with Caching and Retry logic
   */
  async chat(messages: Message[], options: ChatOptions = {}): Promise<LLMResponse> {
    const cacheKey = this.getCacheKey(messages, options);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const response = await this.fetchWithRetry(messages, options);
    this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
    
    return response;
  }

  /**
   * Internal fetch with exponential backoff
   */
  private async fetchWithRetry(
    messages: Message[], 
    options: ChatOptions,
    maxRetries = 3
  ): Promise<LLMResponse> {
    const fullPath = `${this.basePath}/chat/completions`.replace(/\/+/g, '/');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { statusCode, body } = await this.pool.request({
          path: fullPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://github.com/GrandpaEJ/Marie',
            'X-Title': 'Marie v1'
          },
          body: JSON.stringify({
            messages,
            model: options.model || 'openai/gpt-3.5-turbo',
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens,
            stream: options.stream ?? false,
            tools: options.tools,
            tool_choice: options.tool_choice
          })
        });

        if (statusCode !== 200) {
          const errorText = await body.text();
          throw new Error(`HTTP ${statusCode}: ${errorText}`);
        }

        const data: any = await body.json();
        
        return {
          content: data.choices?.[0]?.message?.content || '',
          model: data.model,
          toolCalls: data.choices?.[0]?.message?.tool_calls,
          usage: data.usage
        };
      } catch (error: any) {
        if (attempt === maxRetries) {
          return await this.nativeFallback(messages, options);
        }
        
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[MarieLLM] Retry ${attempt}/${maxRetries} after ${delay}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Unreachable');
  }

  /**
   * Final safety fallback using native global fetch
   */
  private async nativeFallback(messages: Message[], options: ChatOptions): Promise<LLMResponse> {
    console.warn('[MarieLLM] Pool exhausted, using native fetch fallback');
    // Reconstruct full URL from pool origin and basePath
    const origin = (this.pool as any).origin || 'https://openrouter.ai';
    const fullUrl = `${origin}${this.basePath}/chat/completions`.replace(/\/+/g, '/');

    const response = await globalThis.fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/GrandpaEJ/Marie',
        'X-Title': 'Marie v1'
      },
      body: JSON.stringify({
        messages,
        model: options.model || 'openai/gpt-3.5-turbo',
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: options.stream ?? false,
        tools: options.tools,
        tool_choice: options.tool_choice
      })
    });

    if (!response.ok) {
      throw new Error(`Native Fallback Error: ${response.status}`);
    }

    const data: any = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      toolCalls: data.choices?.[0]?.message?.tool_calls,
      usage: data.usage
    };
  }

  private getCacheKey(messages: Message[], options: ChatOptions): string {
    const input = JSON.stringify({ messages, options });
    return createHash('sha256').update(input).digest('hex');
  }

  async destroy(): Promise<void> {
    await this.pool.close();
  }
}
