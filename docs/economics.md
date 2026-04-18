# Economy & Speed

AI models are expensive and variable in their latency. Marie is designed with a **Cost-First Architecture** to help you build profitable AI products.

## 1. Model Routing

The `ModelRouter` allows you to define tiers of models based on task complexity. 

### Why Route?
Most user queries are simple ("Hi", "Thanks", "What time is it?"). Using a frontier model like `gpt-4o` for these is a 20x-50x waste of money. 

```typescript
import { ModelRouter } from "@grandpaej/marie";

const router = new ModelRouter({
  nano: "gpt-4.1-nano",  // Cheap, fast
  fast: "gpt-4o-mini",   // Balanced
  frontier: "gpt-4o"     // Maximum reasoning
});

// The router decides based on:
// 1. Complexity of tools needed
// 2. Length of conversation
// 3. Heuristic analysis of the input
const model = router.route(userInput, toolsEnabled, defaultModel);
```

---

## 2. Semantic Caching

Marie includes a built-in Response Cache. If a user asks the exact same question twice, Marie serves the answer from local memory in **< 1ms** at **$0 cost**.

### Hashing Strategy
Marie uses the **FNV-1a 32-bit hash** of the normalized message history and model configuration. This ensures that a response is only cached if the context is identical.

```typescript
import { MemoryCache } from "@grandpaej/marie";

const agent = new Agent({
  cache: new MemoryCache(500) // Keep the last 500 unique interactions
});
```

---

## 3. Budget Enforcement

Marie protects you from "runaway" agent loops. You can set hard limits on how many steps or how many dollars an agent can spend on a single request.

```typescript
const agent = new Agent({
  budget: {
    maxCostUsd: 0.05,  // Stop if we hit 5 cents
    maxTokens: 5000,   // Stop if we hit 5k tokens
    maxSteps: 5,       // Stop if the agent loops 5+ times
    warnAt: 0.8        // Emit 'budget:warning' at 80% usage
  }
});

agent.on('budget:exceeded', (data) => {
  console.warn("Agent was stopped to protect CPU/Credit limits!");
});
```

### The Safety Valve
If a budget is exceeded mid-turn, Marie throws a `BudgetExceededError`. The conversation state is preserved, but no further LLM calls are made for that turn.
