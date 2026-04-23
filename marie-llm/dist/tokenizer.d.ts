/**
 * Marie-Tokenizer: 0-Dependency, Ultra-Fast BPE Approximation
 * Optimized for cl100k_base (GPT-4 / GPT-3.5)
 */
/**
 * Counts tokens in a string using a high-precision BPE approximation.
 * 0-dependency, fast, and highly accurate for English and Code.
 */
export declare function countTokens(text: string): number;
/**
 * Counts tokens in a message array.
 */
export declare function countMessagesTokens(messages: any[]): number;
