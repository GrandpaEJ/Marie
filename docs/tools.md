# Tools & Skills

Marie agents find their power by interacting with the real world through **Tools**.

## 1. Using Built-in Tools

Marie comes with several production-ready tools in the `tools/` directory.

```typescript
import { webFetch, shellExec, fileWrite } from "@grandpaej/marie/tools";

const agent = new Agent({ ... })
  .register(webFetch)
  .register(shellExec);
```

## 2. Creating Custom Tools

Creating a tool is simple. You just define its schema and a handler function.

```typescript
import { Tool } from "@grandpaej/marie";

const myTool: Tool = {
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string" }
    },
    required: ["city"]
  },
  safe: true, // true if it has no dangerous side effects
  run: async ({ city }) => {
    const data = await fetchWeather(city);
    return `The weather in ${city} is ${data.temp}°C.`;
  }
};

agent.register(myTool);
```

## 3. Safe Mode

Marie features a `safeMode` flag (enabled by default). When `safeMode` is active, the agent is **prohibited** from running any tool marked as `safe: false` (like `shell_exec` or `file_write`).

To enable dangerous tools, you must explicitly disable safe mode:

```typescript
const agent = new Agent({
  // ...
  safeMode: false
});
```
