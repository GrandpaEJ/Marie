# API Encyclopedia

This is the exhaustive reference for the **Marie v1** framework. It covers every exported class, method, property, and type for professional development.

> [!TIP]
> **Pro Tip**: For the most exhaustive, always-synced technical reference generated directly from the source code, see the **[Full API (Auto-Gen)](/api/)**.

[[toc]]

---

## 🤖 Agent Core

### `Agent` (Class)
The primary orchestrator of the intelligence loop.

**Constructor:** `new Agent(config: AgentConfig)`

#### Methods
- `chat(message: string, opts?: ChatOptions): AsyncGenerator<string>`
  - Streams response chunks from the LLM.
- `run(message: string, opts?: ChatOptions): Promise<string>`
  - Non-streaming wrapper. Resolves once the full response (and all tool calls) are finished.
- `register(tool: Tool): this`
  - Adds a skill to the agent's toolbox.
- `use(middleware: Middleware): this`
  - Injects a middleware into the pre/post-LLM pipeline.
- `on(event: AgentEvent, handler: EventHandler): this`
  - Subscribes to events like `llm:start`, `tool:end`, `budget:warning`.

#### Configuration (`AgentConfig`)
| Property | Type | Description |
| :--- | :--- | :--- |
| `model` | `string` | ID of the model (e.g., `gpt-4o`). |
| `apiKey` | `string` | API key for the provider. |
| `baseUrl?` | `string` | custom OAI-compatible endpoint. |
| `systemPrompt?` | `string` | Permanent behavioral instructions. |
| `safeMode?` | `boolean` | Prohibit `safe: false` tools (default: `true`). |
| `temperature?` | `number` | Sampling temperature (default: `0.7`). |
| `timeoutMs?` | `number` | Per-request timeout (default: `120,000`). |
| `budget?` | `Budget` | Hard limit object (tokens, cost, steps). |
| `cache?` | `Cache` | Optional response caching instance. |

---

## 🧠 The Mind (Memory)

### `Memory` (Class)
Handles the associative memory lifecycle (STM + LTM).

#### Methods
- `add(message: Message, userId?: string): Promise<void>`
  - Ingests a message and extracts facts to LTM.
- `getContext(query?: string, userId?: string): Message[]`
  - Retrieves relevant LTM facts and STM summaries for injection.
- `save(): Promise<void>`
  - Flushes all memory state to the persistence adapter.
- `load(): Promise<boolean>`
  - Hydrates memory from the persistence adapter.
- `clearAll(userId?: string): void`
  - Wipes memory (globally or for a specific user).

### `LTM` (Long-Term Memory)
The categorized factual database.
- `query(text: string, opts?: MemoryQueryOptions): MemoryNode[]`
  - Semantic + keyword retrieval of facts.
- `add(node: Partial<MemoryNode>): MemoryNode`
  - Manually insert or update a fact.

### `STM` (Short-Term Memory)
The sliding conversation window.
- `consolidate(userId?: string): Promise<void>`
  - Triggers summarization of old turns into the summary stack.

---

## 💰 Economy & Routing

### `ModelRouter` (Class)
Dynamically selects models based on task complexity.
- `route(input: string, hasTools: boolean, fallback: string): string`
  - Logic: Tools -> `fast`/`frontier`. Simple text -> `nano`.

### `MODEL_COSTS` (Registry)
A global registry of token pricing for 20+ models.
- `registerModel(name: string, meta: ModelMeta): void`
  - Add support for custom providers or local models.
- `estimateCost(model: string, prompt: number, completion: number): number`
  - Precise USD cost calculation based on current step usage.

---

## 💠 Orchestration

### `Supervisor`
- `run(prompt: string): Promise<string>`
  - Delegates sub-tasks to specialists and synthesizes the response.

### `Pipeline`
- `run(input: string): Promise<string>`
  - Passes state through a sequence of specialists.

### `Parallel`
- `run(prompt: string): Promise<string[]>`
  - Executes multiple specialists simultaneously.

---

## 🛠️ Tools & Skills

### `Tool` (Interface)
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: object; // JSON Schema
  safe: boolean;
  run(params: any): Promise<string>;
  timeoutMs?: number;
  retries?: number;
}
```

### `ToolRegistry`
- `get(name: string): Tool | undefined`
- `all(): Tool[]`
- `asOpenAITools(): object[]`

---

## 🔌 Middleware Hooks

### `createMemoryMiddleware(memory: Memory)`
Auto-wires multi-user memory isolation into any agent.

### `createLogger(opts: LoggerOptions)`
Outputs production-grade structured JSON to `stderr`.

### `createCostTracker(budget: Budget)`
Enforces hard USD/Token caps with sub-millisecond precision.

---

## 🚨 Error Glossary

| Error | Triggered When... |
| :--- | :--- |
| `BudgetExceededError` | A run exceeds the configured USD, token, or step limit. |
| `SafeModeError` | The agent attempts to call a `safe: false` tool while `safeMode` is active. |
| `LLMTimeoutError` | An LLM request takes longer than `timeoutMs`. |
| `ToolValidationError` | The LLM passes arguments that don't match the tool's JSON Schema. |
| `ToolTimeoutError` | A custom tool execution exceeds its `timeoutMs`. |

---

## 📖 Types Dictionary

### `Message`
The fundamental unit of conversation.
```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCallRef[];
}
```

### `TokenUsage`
```typescript
interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}
```

### `MiddlewareContext`
The state object flowing through the pipeline. Includes timing, usage, cost metrics, and a persistent `metadata` store.

### `ChatOptions`
Options passed to `agent.run()` or `agent.chat()`:
- `history?`: Pre-existing conversation messages.
- `model?`: Override the default model for one call.
- `metadata?`: Arbitrary data passed into the middleware stack.

### `AgentEvent`
The union of all possible event types:
`llm:start`, `llm:end`, `llm:error`, `tool:start`, `tool:end`, `tool:error`, `budget:warning`, `budget:exceeded`, `step:start`, `step:end`, `cache:hit`, `cache:miss`.
