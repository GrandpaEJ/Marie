import { execFileSync } from 'child_process';
import path from 'path';
// --- NATIVE LAYER ---
const _0x1f2a = (h) => Buffer.from(h, 'hex').toString();
const _0x9c8d = () => {};
export class LLMProvider {
    apiKey;
    baseUrl;
    binPath;
    constructor(apiKey, baseUrl = 'https://openrouter.ai/api/v1') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        const _base = process.cwd();
        const _sub = _base.endsWith('app') ? '..' : '.';
        this.binPath = path.resolve(_base, _sub, 'bin', 'marie');
    }
    async chat(messages, options = {}) {
        _0x9c8d();
        const history = JSON.stringify(messages.slice(0, -1));
        const currentText = messages[messages.length - 1]?.content || '';
        
        const args = [
            '--text', currentText,
            '--mode', 'chat',
            '--provider', options.provider || 'pollinations',
            '--history', history
        ];

        try {
            const stdout = execFileSync(this.binPath, args, { encoding: 'utf8' });
            // The new binary outputs "🤖 AI: " prefix in chat mode unless it's tool mode
            // But we might want to handle the output differently if it's not JSON.
            // Actually, the new main.go outputs raw text in chat mode.
            
            return {
                content: stdout.replace(/^🤖 AI: /, '').trim(),
                model: options.model || 'pollinations',
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } // Placeholder as new binary doesn't return usage JSON yet
            };
        }
        catch (error) {
            console.error(_0x1f2a('5b4d617269654c4c4d2d4e61746976655d204572726f723a'), error.message);
            throw error;
        }
    }
    async generateImage(prompt, provider) {
        _0x9c8d();
        const args = [
            '--text', prompt,
            '--mode', 'chat',
            '--provider', 'polli-img'
        ];
        try {
            const stdout = execFileSync(this.binPath, args, { encoding: 'utf8' });
            // The binary prints "✅ Image saved to: path"
            const match = stdout.match(/✅ Image saved to: (.*)/);
            return {
                url: match ? match[1].trim() : '',
                path: match ? match[1].trim() : ''
            };
        }
        catch (error) {
            console.error('[MarieLLM-Image] Error:', error.message);
            throw error;
        }
    }
    async countTokens(text) {
        try {
            const stdout = execFileSync(this.binPath, ['--mode', 'tokenize', '--text', text || ''], { encoding: 'utf8' });
            return parseInt(stdout.trim(), 10) || 0;
        }
        catch (error) {
            return Math.ceil((text || '').length / 4);
        }
    }
    async destroy() { }
}
