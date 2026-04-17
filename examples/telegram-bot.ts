/**
 * Telegram bot demo — Silvi v1
 * Run: TG_TOKEN=your_token bun run telegram
 * Reads AI_MODEL, AI_API_KEY, AI_BASE_URL from .env automatically.
 *
 * Features:
 *  - Streaming responses (edits the message as tokens arrive)
 *  - Per-user conversation memory (last 20 turns)
 *  - /start and /clear commands
 *  - Budget protection (max $0.50 per run)
 *  - Structured logging to stderr
 */

import { Agent, MemoryCache, createLogger } from '../src/index.ts'
import { telegramAdapter } from '../integrations/telegram.ts'
import { webFetch } from '../tools/index.ts'

// ── Config from .env ───────────────────────────────────────────────────────
const model   = process.env.AI_MODEL   ?? 'gpt-4o-mini'
const apiKey  = process.env.AI_API_KEY ?? ''
const baseUrl = process.env.AI_BASE_URL || undefined
const token   = process.env.TG_TOKEN

if (!token) {
  console.error('❌  Set TG_TOKEN in .env  (TG_TOKEN=your_bot_token)')
  process.exit(1)
}

console.log(`🤖 Starting bot  model=${model}  provider=${baseUrl ?? 'OpenAI'}`)

// ── Agent ──────────────────────────────────────────────────────────────────
const agent = new Agent({
  model,
  apiKey,
  baseUrl,
  safeMode: true,
  systemPrompt: `You are a helpful, friendly assistant available via Telegram.
Be concise — users read on small screens. Use plain text, not markdown.`,
  budget: {
    maxCostUsd: 0.50,
    maxSteps: 10,
  },
  cache: new MemoryCache(300),
  middleware: [
    createLogger({ context: { bot: 'telegram' } }),
  ],
})
  .register(webFetch)

// ── Start adapter ──────────────────────────────────────────────────────────
const bot = telegramAdapter(agent, {
  token,
  startMessage: "👋 Hello! I'm an AI assistant. How can I help you?\n\n/clear — reset conversation",
  pollIntervalMs: 500,
})

console.log('✅  Bot running. Press Ctrl+C to stop.')

process.on('SIGINT', () => {
  bot.stop()
  console.log('\n👋 Bot stopped.')
  process.exit(0)
})

