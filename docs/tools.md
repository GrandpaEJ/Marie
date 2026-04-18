# Skills & Tools

Marie agents gain their power by interacting with the real world through **Tools**. In Marie, we often refer to tools as "Skills".

## 1. Using Built-in Tools

Marie comes with several production-ready tools. You can register them as singletons or create multiple instances with different configurations.

```typescript
import { webFetch, shellExec, fileWrite } from "@grandpaej/marie/tools";

const agent = new Agent({ ... })
  .register(webFetch)
  .register(shellExec);
```

### The Standard Library

| Tool | Permission | Description |
| :--- | :--- | :--- |
| `web_fetch` | `safe: true` | Downloads and converts any URL to GPT-friendly Markdown. |
| `shell_exec` | `safe: false` | Runs arbitrary bash commands. **Warning: Use with caution.** |
| `file_write` | `safe: false` | Writes text to the local filesystem. |
| `file_read` | `safe: true` | Reads text from the local filesystem. |

---

## 2. Creating Custom Tools

Creating a tool is straightforward. You define its schema (compliant with OpenAI's function calling format) and provide a handler.

```typescript
import { Tool } from "@grandpaej/marie";

const myTool: Tool = {
  name: "get_stock_price",
  description: "Get the current market price of a stock",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string" }
    },
    required: ["symbol"]
  },
  safe: true,
  run: async ({ symbol }) => {
    const price = await api.query(symbol);
    return `The price of ${symbol} is $${price}.`;
  }
};

agent.register(myTool);
```

### Tool Design Patterns
- **JSON Parameters**: Use standard JSON Schema for the `parameters` field.
- **Validation**: Marie automatically validates that the LLM passed the correct types before your `run()` function is ever called.
- **Error Handling**: If your `run()` function throws an error, Marie catches it and returns the error message to the LLM so it can try to correct its mistake.

---

## 3. Safe Mode and Permissions

Marie features a **Safe Mode** toggle.

```typescript
const agent = new Agent({
  safeMode: true // default
});
```

When `safeMode` is active:
- Marie will **prohibit** the execution of any tool where `safe: false`.
- If the LLM tries to call a dangerous tool, Marie returns a permission error immediately without executing it.
- This allows you to safely register powerful tools but only enable them for high-privilege sessions or internal use.
