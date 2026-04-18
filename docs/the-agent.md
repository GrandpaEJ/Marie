# The Agent

The `Agent` class is the heart of Marie. It manages the conversation loop, tool execution, and the **Middleware Pipeline**.

## The Configuration

When you instantiate an `Agent`, you are configuring its behavior and constraints:

```typescript
const agent = new Agent({
  model: "gpt-4o",
  apiKey: "...",
  temperature: 0.7,
  timeoutMs: 60000, // global timeout for LLM requests
  safeMode: true,   // prohibit dangerous tools
  budget: {
    maxCostUsd: 0.50,
    maxSteps: 10
  }
});
```

## The Middleware Pipeline

Marie uses a powerful, order-dependent middleware stack. Every request flows through these before and after the LLM call:

1.  **`before(ctx)`**: Ran before the LLM is called. Useful for context injection (like Memory) or pre-flight checks.
2.  **`after(ctx)`**: Ran after the LLM responds (or finishes tool calls). Useful for fact extraction, logging, or cost tracking.
3.  **`onError(ctx, err)`**: Handle failures gracefully.

### Creating Custom Middleware

You can extend Marie without touching the core code:

```typescript
agent.use({
  name: 'my-middleware',
  before(ctx) {
    console.log(`Starting step ${ctx.step} using model ${ctx.model}`);
  },
  after(ctx) {
    console.log(`Step ${ctx.step} used ${ctx.usage.total} tokens.`);
  }
});
```

## Internal Loop (The Brain)

When you call `agent.run()`, Marie performs a sophisticated loop:

1.  **Pre-flight**: Run all `before` middleware.
2.  **LLM Call**: Send messages to the provider. 
3.  **Decision**:
    -   If text: Yield the response.
    -   If tool calls: Validate, run tools, and loop back to step 1 with the results.
4.  **Enforcement**: Check budgets (step count, USD cost) on every iteration.

## Safe Mode

Marie prioritizes safety. If `safeMode: true`, any tool marked as `safe: false` (like writing to files or executing shell commands) will be blocked automatically, even if the LLM requests it. Marie will return a "SafeModeError" to the LLM, allowing it to explain the restriction to the user.
