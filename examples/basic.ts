/**
 * Basic example — runs in Bun: `bun run example`
 * Reads AI_MODEL, AI_API_KEY, AI_BASE_URL from .env automatically.
 *
 * Provider quick-switch via .env:
 *   OpenAI     : AI_BASE_URL=  (leave blank)          AI_MODEL=gpt-4o-mini
 *   OpenRouter : AI_BASE_URL=https://openrouter.ai/api/v1  AI_MODEL=openai/gpt-4o-mini
 *   Groq       : AI_BASE_URL=https://api.groq.com/openai/v1  AI_MODEL=llama3-8b-8192
 *   Ollama     : AI_BASE_URL=http://localhost:11434/v1  AI_MODEL=llama3.2:3b
 */

import { Agent } from '../src/index.ts'
import { webFetch, shell, fileRead } from '../tools/index.ts'

const model   = process.env.AI_MODEL   ?? 'gpt-4o-mini'
const apiKey  = process.env.AI_API_KEY ?? ''
const baseUrl = process.env.AI_BASE_URL || undefined

console.log(`Using model: ${model}  baseUrl: ${baseUrl ?? '(OpenAI default)'}`)

const agent = new Agent({
  model,
  apiKey,
  baseUrl,
  safeMode: true,   // shell/file_write are blocked, webFetch+file_read work fine
  systemPrompt: 'You are a concise assistant. Use tools when needed.',
})
  .register(webFetch)
  .register(shell)  // registered but blocked by safeMode=true
  .register(fileRead)

// --- streaming ---
process.stdout.write('\nAssistant (streaming): ')
for await (const chunk of agent.chat('What is my public IP? Use web_fetch on https://api.ipify.org')) {
  process.stdout.write(chunk)
}
console.log('\n')

// --- single-shot ---
const reply = await agent.run('What is 12 factorial?')
console.log('Reply:', reply)

// --- serve HTTP bridge on port 7700 (uncomment to test Python / curl interop) ---
// agent.serve(7700)
