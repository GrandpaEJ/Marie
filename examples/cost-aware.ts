/**
 * Cost-aware agent demo — Silvi v1
 * Run: bun run cost-aware
 * Reads AI_MODEL, AI_API_KEY, AI_BASE_URL from .env automatically.
 *
 * Demonstrates:
 *  - Model routing (simple → cheap, complex → capable)
 *  - Token budget enforcement (stops before overspending)
 *  - Live cost tracking per request
 *  - Response caching (second identical call = $0)
 */

import { Agent, MemoryCache, ModelRouter, createLogger, createCostTracker, BudgetExceededError } from '../src/index.ts'
import { webFetch } from '../tools/index.ts'

// ── Shared config from .env ────────────────────────────────────────────────
const model   = process.env.AI_MODEL   ?? 'gpt-4o-mini'
const apiKey  = process.env.AI_API_KEY ?? ''
const baseUrl = process.env.AI_BASE_URL || undefined
console.log(`Provider: ${baseUrl ?? 'OpenAI'}  Model: ${model}\n`)

const router = new ModelRouter({
  nano: 'gpt-4.1-nano',    // for simple factual queries
  fast: 'gpt-4o-mini',     // for most tasks
  frontier: 'gpt-4o',      // for complex reasoning
})

const cache = new MemoryCache(200)

const agent = new Agent({
  model,   // default / fallback
  apiKey,
  baseUrl,
  safeMode: true,
  budget: {
    maxTokens: 5_000,
    maxCostUsd: 0.05,      // hard stop at 5 cents per run
    maxSteps: 8,
    warnAt: 0.7,           // warn at 70%
  },
  cache,
  middleware: [
    createLogger({ level: 'info' }),
  ],
  onEvent(event, data) {
    if (event === 'budget:warning') {
      console.warn('⚠️  Budget warning:', data)
    }
    if (event === 'cache:hit') {
      console.log('🎯 Cache hit — free response!')
    }
    if (event === 'tool:start') {
      console.log('🔧 Tool call:', (data as any).name)
    }
  },
})
  .register(webFetch)

// ── Test 1: Simple query → should route to nano model ─────────────────────
console.log('\n--- Test 1: Simple query ---')
const simpleQuery = 'What is 15 * 24?'
const tier = router.classify(simpleQuery, false)
console.log(`Classified tier: ${tier}`)  // expected: nano
const routedModel = router.route(simpleQuery, false, agent.cfg.model)
console.log(`Routed to model: ${routedModel}`)

// ── Test 2: Real agent call with cost tracking ─────────────────────────────
console.log('\n--- Test 2: Agent run with live cost display ---')
let stepCost = 0

const agent2 = new Agent({
  model,
  apiKey,
  baseUrl,
  safeMode: true,
  budget: { maxCostUsd: 0.10, maxSteps: 5 },
  middleware: [
    createLogger(),
    createCostTracker({ maxCostUsd: 0.10 }, (event, data: any) => {
      if (event === 'llm:end') stepCost += data.costUsd ?? 0
    }),
  ],
})

try {
  const result = await agent2.run('Explain what a neural network is in 2 sentences.')
  console.log('Response:', result)
  console.log(`Total cost: $${stepCost.toFixed(6)}`)
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error('Budget exceeded:', err.kind, err.used, '/', err.limit)
  } else {
    throw err
  }
}

// ── Test 3: Cache demo — second call should be instant & free ─────────────
console.log('\n--- Test 3: Cache hit demo ---')
const cacheAgent = new Agent({
  model,
  apiKey,
  baseUrl,
  cache: new MemoryCache(50),
  onEvent(event) {
    if (event === 'cache:hit') console.log('  ✅ Cache hit!')
    if (event === 'cache:miss') console.log('  ❌ Cache miss — calling API')
  },
})

const q = 'What does HTTP stand for?'
console.log('First call (cache miss):')
const t1 = Date.now()
const r1 = await cacheAgent.run(q)
console.log(`  ${r1.trim().slice(0, 60)}… (${Date.now() - t1}ms)`)

console.log('Second call (cache hit):')
const t2 = Date.now()
const r2 = await cacheAgent.run(q)
console.log(`  ${r2.trim().slice(0, 60)}… (${Date.now() - t2}ms)`)

console.log('\n✅ Cost-aware demo complete.')
