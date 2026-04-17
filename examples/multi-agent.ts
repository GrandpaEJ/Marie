/**
 * Multi-agent orchestration demo — Silvi v1
 * Run: bun run multi-agent
 * Reads AI_MODEL, AI_API_KEY, AI_BASE_URL from .env automatically.
 *
 * Demonstrates:
 *  - Supervisor-Worker delegation
 *  - Sequential Pipeline (chain agents)
 *  - Parallel split-and-merge
 */

import { Agent, Supervisor, Pipeline, Parallel } from '../src/index.ts'

// ── Shared config from .env ────────────────────────────────────────────────
const model   = process.env.AI_MODEL   ?? 'gpt-4o-mini'
const apiKey  = process.env.AI_API_KEY ?? ''
const baseUrl = process.env.AI_BASE_URL || undefined
console.log(`Provider: ${baseUrl ?? 'OpenAI'}  Model: ${model}\n`)

const baseConfig = {
  model,
  apiKey,
  baseUrl,
  safeMode: true,
  temperature: 0.5,
}

// ── Demo 1: Sequential Pipeline ───────────────────────────────────────────
console.log('=== Demo 1: Sequential Pipeline ===')
console.log('Task: Outline → Draft → Edit\n')

const outliner = new Agent({ ...baseConfig,
  systemPrompt: 'You create structured outlines. Output a numbered list only.' })

const drafter = new Agent({ ...baseConfig,
  systemPrompt: 'You write first drafts based on outlines. Be concise.' })

const editor = new Agent({ ...baseConfig,
  systemPrompt: 'You improve drafts: fix grammar, improve clarity, tighten prose.' })

const pipeline = new Pipeline([
  {
    agent: outliner,
    transform: (input) => `Create a 3-point outline for a blog post about: ${input}`,
  },
  {
    agent: drafter,
    transform: (outline) => `Write a short blog post draft using this outline:\n${outline}`,
  },
  {
    agent: editor,
    transform: (draft) => `Edit and improve this draft:\n${draft}`,
  },
])

const pipelineResult = await pipeline.run('why Bun is faster than Node.js')
console.log(pipelineResult)
console.log('\n' + '─'.repeat(60) + '\n')

// ── Demo 2: Supervisor-Worker ──────────────────────────────────────────────
console.log('=== Demo 2: Supervisor-Worker ===')
console.log('Task: Research + Summarize with specialist agents\n')

const supervisor = new Agent({ ...baseConfig,
  systemPrompt: 'You are a supervisor. Delegate to specialists when needed.' })

const researcher = new Agent({ ...baseConfig,
  systemPrompt: 'You are a research specialist. Provide factual, detailed information.' })

const summarizer = new Agent({ ...baseConfig,
  systemPrompt: 'You are a summarization specialist. Create concise, clear summaries.' })

const team = new Supervisor({
  supervisor,
  workers: { researcher, summarizer },
  maxRounds: 4,
})

const teamResult = await team.run('What are the top 3 benefits of using TypeScript over JavaScript? Give a brief summary.')
console.log(teamResult)
console.log('\n' + '─'.repeat(60) + '\n')

// ── Demo 3: Parallel split-and-merge ──────────────────────────────────────
console.log('=== Demo 3: Parallel Execution ===')
console.log('Task: Research 3 topics in parallel, then merge\n')

const splitter = new Agent({ ...baseConfig,
  systemPrompt: 'You break tasks into parallel sub-tasks. Always return a valid JSON array.' })

const worker = new Agent({ ...baseConfig,
  systemPrompt: 'You answer questions concisely in 2-3 sentences.' })

const merger = new Agent({ ...baseConfig,
  systemPrompt: 'You synthesize multiple inputs into a cohesive, well-structured answer.' })

const parallel = new Parallel({ splitter, worker, merger, concurrency: 3 })

const parallelResult = await parallel.run(
  'Compare the three main JavaScript runtimes: Node.js, Deno, and Bun. Cover speed, ecosystem, and ease of use.',
)
console.log(parallelResult)

console.log('\n✅ Multi-agent demo complete.')
