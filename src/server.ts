// HTTP bridge — lets Python/any-language bots talk to the agent over localhost.
// POST /chat   → { message, history? } → { text: string }
// POST /stream → { message, history? } → SSE  (data: {"text":"..."}\n\n ... data: [DONE])

import type { Agent } from './agent.ts'
import type { Message } from './types.ts'

interface ChatBody {
  message: string
  history?: Message[]
}

export function startServer(agent: Agent, port: number): void {
  Bun.serve({
    port,
    async fetch(req) {
      if (req.method !== 'POST') {
        return new Response('POST only', { status: 405 })
      }

      let body: ChatBody
      try {
        body = await req.json()
      } catch {
        return new Response('Invalid JSON', { status: 400 })
      }

      const { message, history } = body
      const url = new URL(req.url)
      const cors = { 'Access-Control-Allow-Origin': '*' }

      if (url.pathname === '/chat') {
        const text = await agent.run(message, { history })
        return Response.json({ text }, { headers: cors })
      }

      if (url.pathname === '/stream') {
        const enc = new TextEncoder()
        const stream = new ReadableStream({
          async start(ctrl) {
            for await (const chunk of agent.chat(message, { history })) {
              ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
            }
            ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
            ctrl.close()
          },
        })
        return new Response(stream, {
          headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        })
      }

      return new Response('Not found', { status: 404 })
    },
  })

  console.log(`silvi server → http://localhost:${port}`)
}
