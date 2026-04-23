export function getLLMProvider(apiKey: any): any;
export default LLMProvider;
declare class LLMProvider {
    constructor(apiKey: any, baseUrl?: string);
    client: OpenAI;
    chat(messages: any, options?: {}): Promise<{
        content: string | null;
        usage: OpenAI.Completions.CompletionUsage | undefined;
        model: string;
    }>;
    listModels(): Promise<any>;
}
import OpenAI from 'openai';
//# sourceMappingURL=provider.d.ts.map