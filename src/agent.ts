// Core agent loop — streaming, multi-step tool use, safe mode enforcement.

import { LLMClient } from './client.ts'
import { ToolRegistry } from './tools.ts'
import type { AgentConfig, ChatOptions, Message, Tool, ToolCallAccum } from './types.ts'

export class Agent {
  private client: LLMClient
  readonly registry = new ToolRegistry()
  readonly cfg: Required<AgentConfig>

  constructor(config: AgentConfig) {
    this.cfg = {
      baseUrl: 'https://api.openai.com/v1',
      systemPrompt: 'You are a helpful assistant.',
      safeMode: true,
      maxSteps: 10,
      temperature: 0.7,
      ...config,
    }
    this.client = new LLMClient(this.cfg.apiKey, this.cfg.baseUrl, this.cfg.model)
  }

  register(tool: Tool): this {
    this.registry.register(tool)
    return this
  }

  // Streaming chat — yields text chunks as they arrive.
  // Tool calls are handled transparently inside the loop.
  async *chat(message: string, opts: ChatOptions = {}): AsyncGenerator<string> {
    const messages: Message[] = [
      { role: 'system', content: this.cfg.systemPrompt },
      ...(opts.history ?? []),
      { role: 'user', content: message },
    ]

    const tools = this.registry.toOpenAI(this.cfg.safeMode)

    for (let step = 0; step < this.cfg.maxSteps; step++) {
      const accum: Record<number, ToolCallAccum> = {}
      let content = ''
      let finishReason = ''

      for await (const chunk of this.client.stream({
        model: this.cfg.model,
        messages,
        tools: tools.length ? tools : undefined,
        temperature: this.cfg.temperature,
      })) {
        const choice = chunk.choices[0]
        if (!choice) continue

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
      }

      // No tool calls — we're done
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

      // Execute each tool and push results
      for (const tc of callList) {
        const tool = this.registry.get(tc.name)
        let result: string

        if (!tool) {
          result = `Error: unknown tool "${tc.name}"`
        } else if (this.cfg.safeMode && !tool.safe) {
          result = `Error: "${tc.name}" is blocked in safe mode`
        } else {
          try {
            result = await tool.run(JSON.parse(tc.args))
          } catch (e) {
            result = `Error: ${e instanceof Error ? e.message : String(e)}`
          }
        }

        messages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: tc.name })
      }
    }
  }

  // Convenience wrapper — collects full response as a string
  async run(message: string, opts: ChatOptions = {}): Promise<string> {
    let out = ''
    for await (const chunk of this.chat(message, opts)) out += chunk
    return out
  }

  // Spin up an HTTP bridge so Python / other languages can call this agent
  serve(port = 7700): void {
    import('./server.ts').then(({ startServer }) => startServer(this, port))
  }
}
