export * from './client.js';
export const countTokens = (text: string) => Math.ceil((text || '').length / 4); // Simple fallback
