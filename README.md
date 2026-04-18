# 🕊️ Marie v1

**Marie** (@grandpaej/marie) is a high-performance, cost-optimized agent framework built for **Bun**. It is designed to be the "perfect" agent: scalable, easy to manage, low cost, and high value.

## 📚 Documentation

We have comprehensive documentation available at [docs/](file:///home/grandpa/me/code/py/agent/silvi-v1/docs/index.md).

- **[Getting Started](file:///home/grandpa/me/code/py/agent/silvi-v1/docs/getting-started.md)**: Installation and first agent.
- **[Associative Memory](file:///home/grandpa/me/code/py/agent/silvi-v1/docs/memory.md)**: Human-like memory architecture.
- **[Orchestration](file:///home/grandpa/me/code/py/agent/silvi-v1/docs/orchestration.md)**: Supervisor, Pipeline, and Parallel patterns.
- **[Tools & Skills](file:///home/grandpa/me/code/py/agent/silvi-v1/docs/tools.md)**: Custom tool creation.

To run the documentation site locally:
```bash
bun run docs:dev
```

---

## ✨ Key Features

- 🚀 **Lightning Fast**: Built on Bun with zero runtime dependencies.
- 🧠 **Associative Memory**: Advanced STM/LTM fact extraction out-of-the-box.
- 💰 **Built-in Cost Control**: Semantic caching, model routing, and hard budgets.
- 🛡️ **Safe Mode**: Granular tool permissions for secure autonomy.
- 📦 **Stateless & Scalable**: Production-ready ESM module with multi-user isolation.
- 📱 **Telegram Ready**: Built-in adapter for stateful streaming bots.

---

## 🚀 Installation

Install @grandpaej/marie directly via GitHub:

```bash
bun add https://github.com/GrandpaEJ/Marie.git
```

### Quick Start

```typescript
import { Agent } from "@grandpaej/marie";

const agent = new Agent({
  model: "gpt-4o",
  apiKey: process.env.AI_API_KEY
});

const response = await agent.chat("Hello Marie!");
for await (const chunk of response) {
  process.stdout.write(chunk);
}
```

---

## 📝 License

MIT
