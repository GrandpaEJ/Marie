// Core shared types — keep everything here so imports stay simple

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_call_id?: string       // present on role=tool messages
  tool_calls?: ToolCallRef[]  // present on assistant messages that invoke tools
}

export interface ToolCallRef {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema object
  safe: boolean  // true = allowed even when agent.safeMode=true
  run(params: Record<string, unknown>): Promise<string>
}

export interface AgentConfig {
  model: string
  apiKey: string
  baseUrl?: string      // default: https://api.openai.com/v1 — swap for OpenRouter/Groq/etc.
  systemPrompt?: string
  safeMode?: boolean    // default: true — only safe:true tools can run
  maxSteps?: number     // max tool-call iterations per turn, default 10
  temperature?: number
}

export interface ChatOptions {
  history?: Message[]
}

// Internal accumulator for streaming tool-call fragments
export interface ToolCallAccum {
  id: string
  name: string
  args: string
}
