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

export class LLMProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://openrouter.ai/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Universal Chat Completion
   */
  async chat(messages: Message[], options: ChatOptions = {}): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/GrandpaEJ/Marie', // Required by OpenRouter
        'X-Title': 'Marie v1'
      },
      body: JSON.stringify({
        messages,
        model: options.model || 'openai/gpt-3.5-turbo',
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: options.stream ?? false
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`[LLMClient] API Error: ${response.status} ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      usage: data.usage
    };
  }
}
