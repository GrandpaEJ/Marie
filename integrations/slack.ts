// Slack app adapter using Socket Mode
// Supports slash commands, threaded replies, and streaming

import type { Agent } from '../src/agent.ts'

export interface SlackOptions {
  appToken: string      // xapp-... (Socket Mode)
  botToken: string      // xoxb-... (API calls)
  signingSecret: string // For request verification
  maxMessageLength?: number
}

const MAX_MESSAGE_LENGTH = 3000

export function slackAdapter(agent: Agent, opts: SlackOptions) {
  const { appToken, botToken, maxMessageLength = MAX_MESSAGE_LENGTH } = opts
  const headers = {
    'Authorization': `Bearer ${botToken}`,
    'Content-Type': 'application/json',
  }

  let socket: WebSocket | null = null
  let running = true

  // Acknowledge incoming event
  async function ack(socketMode: boolean, body: any, url?: string) {
    if (socketMode && url) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      })
    }
  }

  // Post ephemeral message (visible to single user)
  async function postEphemeral(channel: string, user: string, text: string) {
    const res = await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        channel,
        user,
        text,
      }),
    })
    return res.json()
  }

  // Post message in thread
  async function postMessage(channel: string, threadTs: string, text: string) {
    const chunks = text.match(/.{1,3000}/g) || [text]
    let ts: string | undefined

    for (const chunk of chunks) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel,
          text: chunk,
          thread_ts: ts || threadTs,
        }),
      })
      const data = await res.json()
      if (!ts) ts = data.ts
    }

    return ts
  }

  // Process slash command
  async function handleSlashCommand(command: any, respondUrl: string) {
    const userMessage = command.text

    // Immediately acknowledge
    await fetch(respondUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'in_channel', text: `@${command.user_name} is thinking...` }),
    })

    let response = ''
    try {
      for await (const chunk of agent.chat(userMessage, {
        metadata: {
          userId: command.user_id,
          channelId: command.channel_id,
          platform: 'slack',
        }
      })) {
        response += chunk
      }
    } catch (err) {
      response = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }

    // Post response in thread
    await postMessage(command.channel_id, command.trigger_id, response)
  }

  // Process mention/event
  async function handleAppMention(event: any, client: any) {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim()
    if (!text) return

    // Post initial response
    const result = await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: '🤔 Thinking...',
    })

    const ts = result.ts
    let response = ''

    try {
      for await (const chunk of agent.chat(text, {
        metadata: {
          userId: event.user,
          channelId: event.channel,
          platform: 'slack',
        }
      })) {
        response += chunk

        // Throttle updates (every 2 seconds)
        if (response.length % 500 < 50) {
          await client.chat.update({
            channel: event.channel,
            ts,
            text: `🤔 ${response.slice(-500)}`,
          })
        }
      }
    } catch (err) {
      response = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }

    // Final message
    await client.chat.update({
      channel: event.channel,
      ts,
      text: response,
    })
  }

  // Socket Mode connection
  async function connect() {
    // Get Socket Mode endpoint
    const res = await fetch('https://slack.com/api/apps.connections.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appToken}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await res.json()

    if (!data.ok) {
      throw new Error(`Socket Mode error: ${data.error}`)
    }

    socket = new WebSocket(data.url)

    socket.onopen = () => {
      console.log('[slack] Connected via Socket Mode')
    }

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'hello':
          break

        case 'slash_commands':
          await handleSlashCommand(data.payload, data.payload.response_url)
          break

        case 'events_api':
          // Acknowledge event
          await fetch('https://slack.com/api/ack', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ envelope_id: data.envelope_id }),
          })

          // Handle event
          if (data.payload.event.type === 'app_mention') {
            await handleAppMention(data.payload.event, {
              chat: {
                postMessage: async (msg: any) => {
                  const res = await fetch('https://slack.com/api/chat.postMessage', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(msg),
                  })
                  return res.json()
                },
                update: async (msg: any) => {
                  const res = await fetch('https://slack.com/api/chat.update', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(msg),
                  })
                  return res.json()
                },
              },
            })
          }
          break
      }
    }

    socket.onclose = () => {
      if (running) {
        console.log('[slack] Connection lost, reconnecting...')
        setTimeout(connect, 5000)
      }
    }
  }

  // Start
  connect().catch(console.error)

  return {
    stop() {
      running = false
      socket?.close()
    },
  }
}