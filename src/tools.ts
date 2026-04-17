// Tool registry — register tools once, query by name or export as OpenAI format.
// v1: added per-tool timeout enforcement, param validation.

import type { Tool } from './types.ts'
import { ToolTimeoutError, ToolValidationError } from './core/errors.ts'

export class ToolRegistry {
  private map = new Map<string, Tool>()

  register(tool: Tool): this {
    this.map.set(tool.name, tool)
    return this
  }

  get(name: string): Tool | undefined {
    return this.map.get(name)
  }

  list(safeOnly = false): Tool[] {
    const all = [...this.map.values()]
    return safeOnly ? all.filter(t => t.safe) : all
  }

  // Converts to the shape the OpenAI API expects in `tools:[...]`
  toOpenAI(safeOnly = false) {
    return this.list(safeOnly).map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  // Execute a tool with validation + timeout enforcement.
  // Throws ToolValidationError, ToolTimeoutError, or re-throws tool errors.
  async run(name: string, params: Record<string, unknown>): Promise<string> {
    const tool = this.map.get(name)
    if (!tool) throw new Error(`Unknown tool: "${name}"`)

    // Param validation (if the tool defines validate())
    if (tool.validate) {
      const err = tool.validate(params)
      if (err) throw new ToolValidationError(name, err)
    }

    const runOnce = () => tool.run(params)

    // Timeout wrapper
    const withTimeout = tool.timeoutMs
      ? () =>
          Promise.race([
            runOnce(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new ToolTimeoutError(name, tool.timeoutMs!)), tool.timeoutMs),
            ),
          ])
      : runOnce

    // Retry wrapper
    const retries = tool.retries ?? 0
    let lastErr: unknown
    for (let i = 0; i <= retries; i++) {
      try {
        return await withTimeout()
      } catch (err) {
        lastErr = err
        if (err instanceof ToolTimeoutError) throw err // no point retrying timeouts
        if (i < retries) await new Promise(r => setTimeout(r, 200 * 2 ** i))
      }
    }
    throw lastErr
  }
}
