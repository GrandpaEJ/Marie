/**
 * Advanced Telegram Bot — Marie v1
 * 
 * Features:
 *  - Persistent Multi-User Memory: Remembers facts about each user individually.
 *  - Scoped SQL Persistence: Saves memories to 'marie-telegram.sqlite'.
 *  - Streaming Responses: Real-time message updates as the LLM thinks.
 *  - Multi-User Isolation: User A's facts never leak to User B.
 *  - Increased Resilience: 120s timeout for slower models.
 */

import { 
  Agent, 
  MemoryCache, 
  createLogger, 
  Memory, 
  SQLiteAdapter, 
  createMemoryMiddleware 
} from '../src/index.ts'
import { telegramAdapter } from '../integrations/telegram.ts'
import { webFetch } from '../tools/index.ts'

// ── Persistence ───────────────────────────────────────────────────────────
const memory = new Memory({
  persist: new SQLiteAdapter('marie-telegram.sqlite'),
  maxStmSummaries: 5,        // Keep more history for active bots
})

// Load existing memories from DB on startup
await memory.load()

// ── Config ────────────────────────────────────────────────────────────────
const model   = process.env.AI_MODEL   ?? 'gpt-4o'
const apiKey  = process.env.AI_API_KEY ?? ''
const baseUrl = process.env.AI_BASE_URL || undefined
const token   = process.env.TG_TOKEN

if (!token) {
  console.error('❌  Set TG_TOKEN in environment or .env')
  process.exit(1)
}

// ── Agent ──────────────────────────────────────────────────────────────────
const agent = new Agent({
  model,
  apiKey,
  baseUrl,
  safeMode: true,
  systemPrompt: `You are a helpful, extremely capable AI assistant. 
You have a long-term memory system. If you know facts about the user, use them.
Be concise. Use plain text.`,
  budget: {
    maxCostUsd: 1.00,
    maxSteps: 10,
  },
  cache: new MemoryCache(300),
  middleware: [
    createLogger({ context: { bot: 'marie-v1' } }),
    createMemoryMiddleware(memory), // <--- Multi-user auto-memory logic
  ],
})
  .register(webFetch)

// ── Start adapter ──────────────────────────────────────────────────────────
const bot = telegramAdapter(agent, {
  token,
  startMessage: "👋 Marie Memory System Active.\n\nI remember our past chats individually. /clear to reset.",
  pollIntervalMs: 500,
  externalHistory: true, // <--- Tell adapter to use our Middleware instead of its own map
})

console.log('✅  Marie Telegram Bot Running. [Multi-User Memory Enabled]')

process.on('SIGINT', async () => {
  await memory.save() // Final save on shutdown
  bot.stop()
  console.log('\n👋 Bot stopped and memory saved.')
  process.exit(0)
})
