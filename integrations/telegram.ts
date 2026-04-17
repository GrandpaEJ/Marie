// Telegram bot adapter — zero additional dependencies.
// Uses the Telegram Bot API via long-polling (no webhooks needed).
// Streams agent responses back to the user in real time by editing the message.
//
// Usage:
//   import { Agent } from 'silvi'
//   import { telegramAdapter } from 'silvi/integrations/telegram'
//   telegramAdapter(agent, { token: process.env.TG_TOKEN! })

import type { Agent } from '../src/agent.ts'

export interface TelegramOptions {
  token: string
  // Polling interval in ms (default: 1000)
  pollIntervalMs?: number
  // Max characters per Telegram message (limit: 4096)
  maxMessageLength?: number
  // Only respond to messages from these user IDs (leave empty for public)
  allowedUserIds?: number[]
  // Custom welcome message
  startMessage?: string
}

const API = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`

async function tgPost(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(API(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export function telegramAdapter(agent: Agent, opts: TelegramOptions): { stop(): void } {
  const { token } = opts
  const pollMs = opts.pollIntervalMs ?? 1000
  const maxLen = opts.maxMessageLength ?? 4000
  const allowed = opts.allowedUserIds ?? []
  const startMsg = opts.startMessage ?? "👋 I'm your AI assistant. Send me a message!"

  let offset = 0
  let running = true

  // Per-user conversation history
  const histories = new Map<number, Array<{ role: 'user' | 'assistant'; content: string }>>()

  async function poll() {
    while (running) {
      try {
        const res = await tgPost(token, 'getUpdates', {
          offset,
          timeout: 20,
          allowed_updates: ['message'],
        })

        if (!res.ok || !res.result?.length) {
          await new Promise(r => setTimeout(r, pollMs))
          continue
        }

        for (const update of res.result) {
          offset = update.update_id + 1
          const msg = update.message
          if (!msg?.text) continue

          const chatId = msg.chat.id
          const userId = msg.from?.id
          const text = msg.text.trim()

          // Authorization check
          if (allowed.length > 0 && !allowed.includes(userId)) {
            await tgPost(token, 'sendMessage', {
              chat_id: chatId,
              text: '⛔ Not authorized.',
            })
            continue
          }

          // /start command
          if (text === '/start') {
            await tgPost(token, 'sendMessage', { chat_id: chatId, text: startMsg })
            histories.delete(chatId)
            continue
          }

          // /clear command
          if (text === '/clear') {
            histories.delete(chatId)
            await tgPost(token, 'sendMessage', { chat_id: chatId, text: '🧹 History cleared.' })
            continue
          }

          // Get or init conversation history
          if (!histories.has(chatId)) histories.set(chatId, [])
          const history = histories.get(chatId)!

          // Send typing indicator
          await tgPost(token, 'sendChatAction', { chat_id: chatId, action: 'typing' })

          // Send placeholder message we'll edit as tokens stream in
          const sentMsg = await tgPost(token, 'sendMessage', {
            chat_id: chatId,
            text: '⏳ Thinking…',
          })
          const msgId = sentMsg.result?.message_id

          // Stream response
          let accumulated = ''
          let lastEdit = 0

          try {
            for await (const chunk of agent.chat(text, { history })) {
              accumulated += chunk
              // Edit the message every 500ms to stream updates to user
              const now = Date.now()
              if (msgId && now - lastEdit > 500) {
                const display = accumulated.slice(-maxLen)
                await tgPost(token, 'editMessageText', {
                  chat_id: chatId,
                  message_id: msgId,
                  text: display || '…',
                })
                lastEdit = now
              }
            }

            // Final edit with complete response
            if (msgId) {
              await tgPost(token, 'editMessageText', {
                chat_id: chatId,
                message_id: msgId,
                text: accumulated.slice(-maxLen) || '✅ Done.',
              })
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error'
            if (msgId) {
              await tgPost(token, 'editMessageText', {
                chat_id: chatId,
                message_id: msgId,
                text: `❌ Error: ${errMsg}`,
              })
            }
          }

          // Update history
          history.push({ role: 'user', content: text })
          history.push({ role: 'assistant', content: accumulated })
          // Keep last 20 turns
          if (history.length > 40) history.splice(0, history.length - 40)
        }
      } catch (err) {
        console.error('[telegram] poll error:', err)
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }

  poll()
  console.log('[telegram] adapter started — polling for messages')

  return {
    stop() { running = false },
  }
}
