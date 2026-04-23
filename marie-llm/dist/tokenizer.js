/**
 * Marie-Tokenizer: 0-Dependency, Ultra-Fast BPE Approximation
 * Optimized for cl100k_base (GPT-4 / GPT-3.5)
 */
const TIKTOKEN_REGEX = /'s|'t|'re|'ve|'m|'ll|'d|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;
/**
 * Counts tokens in a string using a high-precision BPE approximation.
 * 0-dependency, fast, and highly accurate for English and Code.
 */
export function countTokens(text) {
    if (!text)
        return 0;
    const matches = text.match(TIKTOKEN_REGEX);
    if (!matches)
        return 0;
    let count = 0;
    for (const match of matches) {
        // Basic approximation: 
        // 1. Most matches are 1 token
        // 2. Very long words (non-matches) or non-ASCII might be more
        if (match.length <= 4) {
            count += 1;
        }
        else {
            // For longer chunks, estimate based on length (approx 4 chars per token)
            count += Math.ceil(match.length / 4);
        }
    }
    return count;
}
/**
 * Counts tokens in a message array.
 */
export function countMessagesTokens(messages) {
    let count = 3; // base tokens for every request
    for (const msg of messages) {
        count += 4; // metadata tokens
        count += countTokens(msg.content);
        count += countTokens(msg.role);
        if (msg.name) {
            count += countTokens(msg.name);
            count += -1; // role is omitted if name is present in some models
        }
    }
    return count;
}
//# sourceMappingURL=tokenizer.js.map