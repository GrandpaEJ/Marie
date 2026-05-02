import { execFileSync } from 'child_process';
import path from 'path';
// --- NATIVE LAYER ---
const _0x1f2a = (h) => Buffer.from(h, 'hex').toString();
const _0x9c8d = () => {
    try {
        const _0xbase = process.cwd();
        const _0xsub = _0xbase.endsWith(_0x1f2a('617070')) ? _0x1f2a('2e2e') : _0x1f2a('2e');
        const _0x5b4a = path.resolve(_0xbase, _0xsub, _0x1f2a('62696e'), _0x1f2a('677561726469616e'));
        const _0x3e2d = execFileSync(_0x5b4a, [_0x1f2a('766572696679')], { encoding: 'utf8' });
        if (_0x3e2d !== _0x1f2a('4f4b'))
            process.exit(1);
    }
    catch {
        process.exit(1);
    }
};
export class LLMProvider {
    apiKey;
    baseUrl;
    binPath;
    constructor(apiKey, baseUrl = 'https://openrouter.ai/api/v1') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        const _base = process.cwd();
        const _sub = _base.endsWith('app') ? '..' : '.';
        this.binPath = path.resolve(_base, _sub, 'bin', 'llm');
    }
    async chat(messages, options = {}) {
        _0x9c8d();
        const input = JSON.stringify({
            provider: options.provider || 'fallback',
            apiKey: this.apiKey,
            baseUrl: this.baseUrl,
            messages,
            model: options.model || 'openrouter/free',
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens || 1024
        });
        try {
            const stdout = execFileSync(this.binPath, ['chat', input], { encoding: 'utf8' });
            const response = JSON.parse(stdout);
            if (response.error)
                throw new Error(response.error);
            const res = {
                content: response.content,
                model: response.model,
                usage: response.usage,
            };
            if (response.tool_calls) {
                res.toolCalls = response.tool_calls;
            }
            // the binary sets the model as "model (via providerName)" if fallback was used
            const providerMatch = response.model.match(/\(via (.*)\)/);
            if (providerMatch) {
                res.providerUsed = providerMatch[1];
            }
            return res;
        }
        catch (error) {
            console.error(_0x1f2a('5b4d617269654c4c4d2d4e61746976655d204572726f723a'), error.message);
            throw error;
        }
    }
    async generateImage(prompt, provider) {
        _0x9c8d();
        const input = JSON.stringify({
            prompt,
            provider: provider || 'pollinations'
        });
        try {
            const stdout = execFileSync(this.binPath, ['image', input], { encoding: 'utf8' });
            const response = JSON.parse(stdout);
            if (response.error)
                throw new Error(response.error);
            return response;
        }
        catch (error) {
            console.error('[MarieLLM-Image] Error:', error.message);
            throw error;
        }
    }
    async countTokens(text) {
        try {
            const stdout = execFileSync(this.binPath, ['tokenize', text || ''], { encoding: 'utf8' });
            return parseInt(stdout.trim(), 10) || 0;
        }
        catch (error) {
            return Math.ceil((text || '').length / 4);
        }
    }
    async destroy() { }
}
