// Discord bot adapter using Discord's HTTP API
// Supports slash commands, message replies, and streaming responses

import type { Agent } from '../src/agent.ts'

export interface DiscordOptions {
  token: string
  applicationId: string
  guildId?: string // Optional for global commands
  maxMessageLength?: number
}

interface DiscordMessage {
  id: string
  content: string
  author: { id: string; username: string }
  channel_id: string
  guild_id?: string
}

const API_BASE = 'https://discord.com/api/v10'

async function discordRequest(
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Discord API error ${res.status}: ${error}`)
  }

  return res.json()
}

export function discordAdapter(agent: Agent, opts: DiscordOptions) {
  const { token, applicationId, guildId } = opts
  const maxLen = opts.maxMessageLength ?? 2000
  const headers = { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' }

  let ws: WebSocket | null = null
  let sequence = 0
  let sessionId: string
  let running = true

  // Command handlers
  const commands = new Map<string, (msg: any) => Promise<string>>()

  // Register /marie slash command
  async function registerCommands() {
    const command = {
      name: 'marie',
      description: 'Chat with Marie AI assistant',
      options: [
        {
          type: 3, // STRING
          name: 'message',
          description: 'Your message to Marie',
          required: true,
        },
      ],
    }

    const path = guildId
      ? `/applications/${applicationId}/guilds/${guildId}/commands`
      : `/applications/${applicationId}/commands`

    await discordRequest(token, 'POST', path, command)
    console.log('[discord] Commands registered')
  }

  // Send a message via HTTP
  async function sendMessage(channelId: string, content: string, replyTo?: string) {
    const chunks = content.match(/.{1,2000}/g) || [content]

    for (const chunk of chunks) {
      const body: Record<string, unknown> = { content: chunk }
      if (replyTo) body.message_reference = { message_id: replyTo }

      await fetch(`${API_BASE}/channels/${channelId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    }
  }

  // Process Marie response and stream to Discord
  async function processMessage(msg: DiscordMessage, userMessage: string) {
    await sendMessage(msg.channel_id, '🤔 Thinking...', msg.id)

    let response = ''
    try {
      for await (const chunk of agent.chat(userMessage, {
        metadata: { userId: msg.author.id, platform: 'discord' }
      })) {
        response += chunk
        // Edit message with accumulating response
        if (response.length < 2000) {
          // For now, just collect - Discord edits are rate limited
        }
      }
    } catch (err) {
      response = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }

    // Send final response
    if (response.length > maxLen) {
      await sendMessage(msg.channel_id, response.slice(0, maxLen))
      if (response.length > maxLen * 2) {
        await sendMessage(msg.channel_id, response.slice(maxLen, maxLen * 2))
      }
    } else {
      await sendMessage(msg.channel_id, response || 'Done.')
    }
  }

  // Handle incoming messages
  function handleMessage(data: any) {
    if (data.t === 'MESSAGE_CREATE') {
      const msg = data.d as DiscordMessage
      // Ignore bot messages and messages without prefix
      if (msg.author.bot) return
      if (!msg.content.startsWith('/marie ')) return

      const userMessage = msg.content.slice(7).trim()
      if (!userMessage) {
        sendMessage(msg.channel_id, 'Usage: /marie <message>')
        return
      }

      processMessage(msg, userMessage)
    }
  }

  // WebSocket connection
  async function connect() {
    // Get gateway URL
    const gateway = await discordRequest(token, 'GET', '/gateway')
    ws = new WebSocket(`${gateway.url}?v=10&encoding=json`)

    ws.onopen = () => {
      console.log('[discord] Connected to gateway')
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      switch (data.op) {
        case 10: // Hello
          // Send identify
          ws?.send(JSON.stringify({
            op: 2,
            d: {
              token,
              intents: 1 << 9, // MESSAGE_CONTENT intent
              properties: { os: 'linux', browser: 'marie', device: 'marie' },
            },
          }))
          break

        case 0: // Dispatch
          sequence = data.s
          handleMessage(data)
          break

        case 11: // Heartbeat ACK
          break
      }
    }

    ws.onclose = () => {
      if (running) {
        console.log('[discord] Connection lost, reconnecting...')
        setTimeout(connect, 5000)
      }
    }
  }

  // Start
  registerCommands().then(connect)

  return {
    stop() {
      running = false
      ws?.close()
    },
  }
}