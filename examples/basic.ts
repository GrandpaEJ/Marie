/**
 * Basic example — runs in Bun: `bun examples/basic.ts`
 *
 * Switch provider by changing baseUrl + model:
 *   OpenRouter : baseUrl='https://openrouter.ai/api/v1',  model='openai/gpt-4o-mini'
 *   Groq       : baseUrl='https://api.groq.com/openai/v1', model='llama3-8b-8192'
 *   OpenAI     : baseUrl omitted (default),                model='gpt-4o-mini'
 */

import { Agent } from '../src/index.ts'
import { webFetch, shell, fileRead } from '../tools/index.ts'

const agent = new Agent({
  model: 'gpt-4o-mini',
  apiKey: process.env.API_KEY ?? '',
  // baseUrl: 'https://openrouter.ai/api/v1',
  safeMode: true,         // shell/file_write are blocked, webFetch+file_read work fine
  systemPrompt: 'You are a concise assistant. Use tools when needed.',
})
  .register(webFetch)
  .register(shell)    // registered but blocked by safeMode=true
  .register(fileRead)

// --- streaming ---
process.stdout.write('Assistant: ')
for await (const chunk of agent.chat('What is my public IP? Use web_fetch on https://api.ipify.org')) {
  process.stdout.write(chunk)
}
console.log('\n')

// --- single-shot ---
const reply = await agent.run('What is 12 factorial?')
console.log('Reply:', reply)

// --- serve HTTP bridge on port 7700 (uncomment to test Python interop) ---
// agent.serve(7700)
