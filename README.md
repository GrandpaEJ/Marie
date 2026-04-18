<div align="center">
  <img src="docs/public/banner.png" alt="Marie Logo" width="800">
</div>

# 🕊️ Marie Universal 

**Marie** (@grandpaej/marie) is a high-performance, cross-platform AI agent framework powered by a **Rust Universal Core**. It is designed to be the "perfect" agent: scalable, safe, cost-aware, and usable in any language—from **Python on Termux** to **TypeScript on Cloud**.

## 🚀 Key Features

- 🧠 **Universal Core (Rust)**: One brain, many languages. High-speed logic, safety, and budgeting.
- 💰 **Strict Cost Control**: Real-time token tracking and USD hard budgets enforced in Rust.
- 🛡️ **Safe Mode**: Granular permissions (e.g., shell/web) enforced before execution.
- 📦 **Multi-Language**: Native support for **Python** and **TypeScript** (Bun/Node).
- 📱 **All-Device**: Optimized for Termux (Android), Render (Cloud), and local dev.
- 📱 **Telegram & Facebook**: Built-in adapters for stateful streaming bots.

---

## 📚 Documentation

Detailed guides are available at [docs/](docs/index.md).

- **[Getting Started](docs/getting-started.md)**: Build the core and run your first agent.
- **[Universal Core](docs/universal-core.md)**: Deep dive into the Rust architecture.
- **[Python Client](docs/python-client.md)**: Usage guide for Python developers.
- **[Tools & Skills](docs/tools.md)**: Creating and registering custom tools.

---

## 🚀 Quick Start (Python)

Ensure you have [Rust](https://rustup.rs/) installed, then build the core:

```bash
bash build.sh
```

### Run Marie in Python:

```python
from marie.agent import MarieAgent
from marie.tools import ShellTool

agent = MarieAgent(api_key="sk-...", safe_mode=True)
agent.register_tool(ShellTool()) # Needs safe_mode=False to execute

response = agent.chat("Marie, check my disk usage.")
print(response)
```

---

## 🚀 Quick Start (TypeScript)

Marie is built for **Bun** for maximum performance.

```bash
bun add https://github.com/GrandpaEJ/Marie.git
```

```typescript
import { Agent } from "@grandpaej/marie";

const agent = new Agent({
  model: "gpt-4o",
  apiKey: process.env.AI_API_KEY,
});

const response = await agent.chat("Hello Marie!");
console.log(response);
```

---

## 🛠 Building for Development

To build the documentation site locally:

```bash
bun run docs:dev
```

To rebuild the Rust Core and bindings:

```bash
bash build.sh
```

---

## 📝 License

MIT
