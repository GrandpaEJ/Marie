// HTTP bridge v1 — adds health, metrics, auth header support.
// POST /chat    { message, history? } → { text: string }
// POST /stream  { message, history? } → SSE  data: {"text":"..."} … data: [DONE]
// GET  /health  → { status: "ok", uptime, version }
// GET  /metrics → live request + token + cost metrics

import type { Agent } from './agent.ts'
import type { Message } from './types.ts'

interface ChatBody {
  message: string
  history?: Message[]
  model?: string  // optional per-request model override
}

interface Metrics {
  requests: number
  totalTokens: number
  totalCostUsd: number
  errors: number
  startedAt: number
}

export function startServer(agent: Agent, port: number, opts: { apiKey?: string } = {}): void {
  const metrics: Metrics = {
    requests: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    errors: 0,
    startedAt: Date.now(),
  }

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  Bun.serve({
    port,
    async fetch(req: Request) {
      const url = new URL(req.url)

      // Preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors })
      }

      // ── Auth ──────────────────────────────────────────────────────────
      if (opts.apiKey) {
        const auth = req.headers.get('Authorization') ?? ''
        if (auth !== `Bearer ${opts.apiKey}`) {
          return new Response('Unauthorized', { status: 401, headers: cors })
        }
      }

      // ── Health ────────────────────────────────────────────────────────
      if (req.method === 'GET' && url.pathname === '/health') {
        return Response.json({
          status: 'ok',
          uptimeMs: Date.now() - metrics.startedAt,
          version: '2.0.0',
          model: agent.cfg.model,
        }, { headers: cors })
      }

      // ── Metrics ───────────────────────────────────────────────────────
      if (req.method === 'GET' && url.pathname === '/metrics') {
        return Response.json({
          ...metrics,
          uptimeMs: Date.now() - metrics.startedAt,
          avgCostPerRequest: metrics.requests
            ? (metrics.totalCostUsd / metrics.requests).toFixed(6)
            : '0',
        }, { headers: cors })
      }

      // ── Chat / Stream ─────────────────────────────────────────────────
      if (req.method !== 'POST') {
        return new Response('POST only for /chat and /stream', { status: 405, headers: cors })
      }

      let body: ChatBody
      try {
        body = await req.json()
      } catch {
        return new Response('Invalid JSON', { status: 400, headers: cors })
      }

      const { message, history, model } = body
      metrics.requests++

      // Track events from the agent on this request
      let reqTokens = 0
      let reqCost = 0
      const unsub = (event: string, data: unknown) => {
        if (event === 'llm:end') {
          const d = data as any
          reqTokens += d?.usage?.total ?? 0
          reqCost += d?.costUsd ?? 0
        }
      }
      agent.on(unsub as any)

      const cleanup = () => {
        metrics.totalTokens += reqTokens
        metrics.totalCostUsd += reqCost
      }

      if (url.pathname === '/chat') {
        try {
          const text = await agent.run(message, { history, model })
          cleanup()
          return Response.json({ text }, { headers: cors })
        } catch (err) {
          cleanup()
          metrics.errors++
          const msg = err instanceof Error ? err.message : 'Unknown error'
          return Response.json({ error: msg }, { status: 500, headers: cors })
        }
      }

      if (url.pathname === '/stream') {
        const enc = new TextEncoder()
        const stream = new ReadableStream({
          async start(ctrl) {
            try {
              for await (const chunk of agent.chat(message, { history, model })) {
                ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
              }
              ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
            } catch (err) {
              metrics.errors++
              const msg = err instanceof Error ? err.message : 'Unknown error'
              ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
            } finally {
              cleanup()
              ctrl.close()
            }
          },
        })
        return new Response(stream, {
          headers: {
            ...cors,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      }

      return new Response('Not found', { status: 404, headers: cors })
    },
  })

  console.log(`silvi server → http://localhost:${port}`)
  console.log(`  POST /chat   → full response`)
  console.log(`  POST /stream → SSE streaming`)
  console.log(`  GET  /health → health check`)
  console.log(`  GET  /metrics → live stats`)
}
