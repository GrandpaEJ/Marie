# Multi-Agent Orchestration

Marie provides powerful primitives for building multi-agent systems using the **Supervisor**, **Pipeline**, and **Parallel** patterns.

## 1. Supervisor Pattern

The Supervisor acts as a central "brain" that delegates complex tasks to specialist agents. It decomposes a prompt, selects the right agent for each sub-task, and merges the results.

```typescript
import { Agent, Supervisor } from "silvi";

const researcher = new Agent({ ... });
const writer = new Agent({ ... });

const supervisor = new Supervisor({
  agent, // the main model that decides delegation
  specialists: { researcher, writer }
});

const result = await supervisor.run("Research the history of Bun and write a summary.");
```

## 2. Pipeline Pattern

Pipelines run tasks in a strict sequence, where the output of one agent becomes the input for the next. This is ideal for iterative workflows like `Outline → Draft → Edit`.

```typescript
import { Pipeline } from "silvi";

const pipeline = new Pipeline([agentA, agentB, agentC]);
const finalResult = await pipeline.run("Starting prompt");
```

## 3. Parallel Pattern

The Parallel pattern splits a single prompt into multiple sub-tasks that run simultaneously. This is great for gathering multiple viewpoints or performing broad research quickly.

```typescript
import { Parallel } from "silvi";

const parallel = new Parallel([agent1, agent2, agent3]);
const results = await parallel.run("Analyze this data from three different perspectives.");
```
