// Thin streaming HTTP client for any OpenAI-compatible API.
// No SDK dependency — just fetch + SSE parsing.

import type { Message, ToolCallRef } from './types.ts'

interface StreamChunk {
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
}

interface CompletionReq {
  model: string
  messages: Message[]
  tools?: unknown[]
  temperature?: number
}

export class LLMClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
  ) {}

  async *stream(req: CompletionReq): AsyncGenerator<StreamChunk> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...req, stream: true }),
    })

    if (!res.ok) {
      throw new Error(`LLM ${res.status}: ${await res.text()}`)
    }

    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') return
        try { yield JSON.parse(data) } catch { /* malformed chunk — skip */ }
      }
    }
  }

  // Non-streaming fallback (used internally; prefer stream for UX)
  async complete(req: CompletionReq): Promise<{ content: string | null; tool_calls?: ToolCallRef[] }> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(req),
    })

    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`)

    const json = await res.json()
    const msg = json.choices[0].message
    return { content: msg.content, tool_calls: msg.tool_calls }
  }
}
