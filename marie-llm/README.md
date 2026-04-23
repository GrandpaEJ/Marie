# @marie/llm

Universal LLM provider and prompt utilities for the Marie AI Agent ecosystem.

## Features
- **Multi-Model Provider**: OpenAI-compatible interface for OpenRouter, DeepSeek, and more.
- **Prompt Engineering**: Tools for building structured system prompts and user input wrapping.
- **Tokenization**: Standardized `js-tiktoken` utilities for precise context management.

## Usage
```javascript
import { LLMProvider, countTokens } from '@marie/llm';

const llm = new LLMProvider(apiKey);
const response = await llm.chat([{ role: 'user', content: 'Hello' }]);
```
