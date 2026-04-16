// Tool registry — register tools once, query by name or export as OpenAI format.

import type { Tool } from './types.ts'

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
}
