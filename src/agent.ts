// Core agent loop — v1.
// Streaming, multi-step tool use, safe-mode enforcement, middleware pipeline,
// event emitter, budget enforcement, and optional response caching.

import { LLMClient } from './client.ts'
import { ToolRegistry } from './tools.ts'
import { BudgetExceededError, SafeModeError } from './core/errors.ts'
import { createCostTracker } from './middleware/cost-tracker.ts'
import type {
  AgentConfig,
  AgentEvent,
  Cache,
  ChatOptions,
  CostMetrics,
  Message,
  Middleware,
  MiddlewareContext,
  Tool,
  ToolCallAccum,
  TokenUsage,
} from './types.ts'

// ── Cache key ──────────────────────────────────────────────────────────────

function cacheKey(model: string, messages: Message[]): string {
  // FNV-1a-like hash: fast, no deps, good for string keys
  let h = 2166136261
  const s = model + JSON.stringify(messages)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h.toString(16)
}

// ── MiniEventEmitter (zero deps) ───────────────────────────────────────────

class EventEmitter {
  private handlers: Array<(event: AgentEvent, data: unknown) => void> = []

  on(handler: (event: AgentEvent, data: unknown) => void): void {
    this.handlers.push(handler)
  }

  emit(event: AgentEvent, data: unknown = {}): void {
    for (const h of this.handlers) {
      try { h(event, data) } catch { /* never let event handlers crash the loop */ }
    }
  }
}

// ── Agent ─────────────────────────────────────────────────────────────────

export class Agent {
  private client: LLMClient
  readonly registry = new ToolRegistry()
  readonly cfg: Required<Omit<AgentConfig, 'budget' | 'middleware' | 'cache' | 'onEvent'>>
    & Pick<AgentConfig, 'budget' | 'middleware' | 'cache' | 'onEvent'>

  private emitter = new EventEmitter()
  private _middleware: Middleware[] = []

  constructor(config: AgentConfig) {
    this.cfg = {
      baseUrl: 'https://api.openai.com/v1',
      systemPrompt: 'You are a helpful assistant.',
      safeMode: true,
      maxSteps: 10,
      temperature: 0.7,
      timeoutMs: 60_000,
      ...config,
    }

    this.client = new LLMClient(
      this.cfg.apiKey,
      this.cfg.baseUrl,
      this.cfg.model,
      { timeoutMs: this.cfg.timeoutMs },
    )

    // Wire up middleware from config
    this._middleware = [...(config.middleware ?? [])]

    // Wire up onEvent handler
    if (config.onEvent) this.emitter.on(config.onEvent)
  }

  // ── Public builder API ──────────────────────────────────────────────────

  register(tool: Tool): this {
    this.registry.register(tool)
    return this
  }

  use(middleware: Middleware): this {
    this._middleware.push(middleware)
    return this
  }

  on(handler: (event: AgentEvent, data: unknown) => void): this {
    this.emitter.on(handler)
    return this
  }

  // ── Streaming chat ──────────────────────────────────────────────────────
  // Yields text chunks as they arrive. Tool calls are handled transparently.

  async *chat(userMessage: string, opts: ChatOptions = {}): AsyncGenerator<string> {
    const model = opts.model ?? this.cfg.model
    const startedAt = Date.now()
    const budget = this.cfg.budget ?? {}
    const cache = this.cfg.cache

    // ── Build middleware stack ────────────────────────────────────────────
    // cost-tracker is always injected first (it updates ctx.costUsd)
    const costTracker = createCostTracker(
      { maxSteps: this.cfg.maxSteps, ...budget },
      (event, data) => this.emitter.emit(event as AgentEvent, data),
    )
    const middlewareStack: Middleware[] = [costTracker, ...this._middleware]

    // ── Build initial message list ────────────────────────────────────────
    const messages: Message[] = [
      { role: 'system', content: this.cfg.systemPrompt },
      ...(opts.history ?? []),
      { role: 'user', content: userMessage },
    ]

    const tools = this.registry.toOpenAI(this.cfg.safeMode)

    // ── Agent loop ────────────────────────────────────────────────────────
    for (let step = 0; step < this.cfg.maxSteps; step++) {
      this.emitter.emit('step:start', { step })

      // Build middleware context for this step
      const ctx: MiddlewareContext = {
        messages,
        model,
        step,
        usage: { prompt: 0, completion: 0, total: 0 },
        costUsd: 0,
        startedAt,
        cached: false,
        metadata: {},
      }

      // ── Cache check (only for first step, no tools mid-conversation) ───
      const key = step === 0 ? cacheKey(model, messages) : null
      if (cache && key) {
        const hit = await cache.get(key)
        if (hit !== null) {
          ctx.cached = true
          this.emitter.emit('cache:hit', { step, key })
          yield hit
          this.emitter.emit('step:end', { step, cached: true })
          return
        }
        this.emitter.emit('cache:miss', { step, key })
      }

      // ── Run 'before' middleware ────────────────────────────────────────
      try {
        for (const mw of middlewareStack) {
          await mw.before?.(ctx)
        }
      } catch (err) {
        if (err instanceof BudgetExceededError) throw err
        throw err
      }

      this.emitter.emit('llm:start', { step, model })

      // ── Stream LLM response ───────────────────────────────────────────
      const accum: Record<number, ToolCallAccum> = {}
      let content = ''
      let finishReason = ''
      const stepUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 }

      try {
        for await (const chunk of this.client.stream({ model, messages, tools: tools.length ? tools : undefined, temperature: this.cfg.temperature })) {
          const choice = chunk.choices[0]
          if (!choice) {
            // Usage chunk (some providers send usage in a separate chunk with no choices)
            if ((chunk as any).usage) {
              const u = (chunk as any).usage
              stepUsage.prompt = u.prompt_tokens ?? 0
              stepUsage.completion = u.completion_tokens ?? 0
              stepUsage.total = u.total_tokens ?? 0
            }
            continue
          }

          if (choice.finish_reason) finishReason = choice.finish_reason

          if (choice.delta.content) {
            content += choice.delta.content
            yield choice.delta.content
          }

          for (const tc of choice.delta.tool_calls ?? []) {
            const a = (accum[tc.index] ??= { id: '', name: '', args: '' })
            if (tc.id) a.id = tc.id
            if (tc.function?.name) a.name += tc.function.name
            if (tc.function?.arguments) a.args += tc.function.arguments
          }

          // Capture usage from final streaming chunk (stream_options.include_usage)
          if ((chunk as any).usage) {
            const u = (chunk as any).usage
            stepUsage.prompt = u.prompt_tokens ?? stepUsage.prompt
            stepUsage.completion = u.completion_tokens ?? stepUsage.completion
            stepUsage.total = u.total_tokens ?? stepUsage.total
          }
        }
      } catch (err) {
        for (const mw of middlewareStack) {
          await mw.onError?.(ctx, err instanceof Error ? err : new Error(String(err)))
        }
        this.emitter.emit('llm:error', { step, err })
        throw err
      }

      // ── Update ctx with real usage ─────────────────────────────────────
      ctx.usage = stepUsage

      this.emitter.emit('llm:end', { step, usage: stepUsage, finishReason })

      // ── Cache the response (first step, no tool calls) ─────────────────
      if (cache && key && finishReason !== 'tool_calls' && content) {
        await cache.set(key, content)
      }

      // ── Run 'after' middleware ────────────────────────────────────────
      for (const mw of middlewareStack) {
        await mw.after?.(ctx)
      }

      this.emitter.emit('step:end', { step, usage: stepUsage, cached: false })

      // ── Exit if no tool calls ─────────────────────────────────────────
      if (finishReason !== 'tool_calls') break

      const callList = Object.values(accum)

      // Push assistant turn (with tool_calls list)
      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: callList.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.args },
        })),
      })

      // ── Execute tools ─────────────────────────────────────────────────
      for (const tc of callList) {
        const tool = this.registry.get(tc.name)
        let result: string

        this.emitter.emit('tool:start', { name: tc.name, args: tc.args })

        if (!tool) {
          result = `Error: unknown tool "${tc.name}"`
        } else if (this.cfg.safeMode && !tool.safe) {
          const err = new SafeModeError(tc.name)
          this.emitter.emit('tool:error', { name: tc.name, err })
          result = err.message
        } else {
          try {
            result = await this.registry.run(tc.name, JSON.parse(tc.args))
            this.emitter.emit('tool:end', { name: tc.name, result })
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            this.emitter.emit('tool:error', { name: tc.name, err: e })
            result = `Error: ${msg}`
          }
        }

        messages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: tc.name })
      }
    }
  }

  // ── Convenience: collect full response ─────────────────────────────────

  async run(message: string, opts: ChatOptions = {}): Promise<string & { metrics: CostMetrics }> {
    let out = ''
    for await (const chunk of this.chat(message, opts)) out += chunk
    return out as string & { metrics: CostMetrics }
  }

  // ── HTTP bridge ─────────────────────────────────────────────────────────

  serve(port = 7700): void {
    import('./server.ts').then(({ startServer }) => startServer(this, port))
  }
}
