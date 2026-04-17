// Thin streaming HTTP client for any OpenAI-compatible API.
// v1: added retry/backoff, per-request timeout, token usage parsing.
// No SDK dependency — just fetch + SSE parsing.

import type { Message, ToolCallRef, TokenUsage } from './types.ts'
import { LLMError, LLMTimeoutError } from './core/errors.ts'

// ── Wire types ─────────────────────────────────────────────────────────────

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
  // Some providers send usage in the final delta chunk
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

interface CompletionReq {
  model: string
  messages: Message[]
  tools?: unknown[]
  temperature?: number
  stream_options?: { include_usage: boolean }
}

export interface StreamResult {
  chunks: AsyncGenerator<StreamChunk>
  usage: TokenUsage  // populated after generator exhausted
}

// ── Retry helper ───────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs = 500,
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable = err instanceof LLMError && err.retryable
      if (!isRetryable || attempt >= maxRetries) throw err
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 200
      await new Promise(r => setTimeout(r, delay))
      attempt++
    }
  }
}

// ── LLMClient ─────────────────────────────────────────────────────────────

export class LLMClient {
  private maxRetries: number
  private timeoutMs: number

  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
    opts: { maxRetries?: number; timeoutMs?: number } = {},
  ) {
    this.maxRetries = opts.maxRetries ?? 3
    this.timeoutMs = opts.timeoutMs ?? 120_000  // 2 min — covers slow/large models in parallel
  }

  // Streaming completion — yields raw SSE chunks.
  // usage is accumulated from the final usage chunk (OpenAI stream_options)
  // or estimated from content length as a fallback.
  async *stream(
    req: CompletionReq,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk & { _usage?: TokenUsage }> {
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), this.timeoutMs)

    // Merge caller signal + timeout signal
    const combinedSignal =
      signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal

    const doFetch = () =>
      fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          ...req,
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: combinedSignal,
      }).then(res => {
        if (!res.ok) {
          return res.text().then(body => {
            throw new LLMError({ status: res.status, provider: this.baseUrl, body })
          })
        }
        return res
      })

    let res: Response
    try {
      res = await withRetry(doFetch, this.maxRetries)
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LLMTimeoutError(this.timeoutMs)
      }
      throw err
    }

    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''

    try {
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
          try {
            yield JSON.parse(data)
          } catch {
            /* malformed chunk — skip */
          }
        }
      }
    } catch (err) {
      // AbortError fires here when timeout hits mid-stream (slow/large models)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LLMTimeoutError(this.timeoutMs)
      }
      throw err
    } finally {
      clearTimeout(timer)
      reader.releaseLock()
    }
  }

  // Non-streaming completion — returns content + tool_calls + token usage.
  async complete(req: CompletionReq): Promise<{
    content: string | null
    tool_calls?: ToolCallRef[]
    usage: TokenUsage
  }> {
    const doFetch = () =>
      fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(this.timeoutMs),
      }).then(async res => {
        if (!res.ok)
          throw new LLMError({ status: res.status, provider: this.baseUrl, body: await res.text() })
        return res.json()
      })

    const json = await withRetry(doFetch, this.maxRetries)
    const msg = json.choices[0].message
    const u = json.usage ?? {}
    return {
      content: msg.content,
      tool_calls: msg.tool_calls,
      usage: {
        prompt: u.prompt_tokens ?? 0,
        completion: u.completion_tokens ?? 0,
        total: u.total_tokens ?? 0,
      },
    }
  }
}
