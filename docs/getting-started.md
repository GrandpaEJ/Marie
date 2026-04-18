# Getting Started with Marie

This guide will walk you through setting up the **Universal Marie Agent** on your local machine or Termux.

## Prerequisites

- **Rust**: To build the core. `pkg install rust` (Termux) or according to [rustup.rs](https://rustup.rs/).
- **Python**: 3.10 or higher.
- **Bun** (Optional): If you want to run the legacy TS examples or the docs site.

## 1. Build the Core

Marie uses a Rust-based core for performance and safety. First, you need to compile it and generate the Python bindings:

```bash
# Clone the repository
git clone https://github.com/GrandpaEJ/Marie.git
cd Marie

# Run the build script
bash build.sh
```

This will create the `libmarie_core.so` and the Python package in `clients/python/marie`.

## 2. Your First Python Agent

Create a file named `my_agent.py`:

```python
import sys
import os

# Ensure the library is in your path
sys.path.append(os.path.join(os.getcwd(), 'clients', 'python'))

from marie.agent import MarieAgent

agent = MarieAgent(api_key=os.getenv("AI_API_KEY"), model="gpt-3.5-turbo")
response = agent.chat("Marie, tell me a short joke.")
print(response)
```

Run it:
```bash
export AI_API_KEY="sk-..."
python3 my_agent.py
```

## 3. Next Steps

- Explore the **[Python Client API](python-client.md)** for advanced features like budgeting and tools.
- Learn about the **[Universal Rust Core](universal-core.md)** architecture.
- Connect Marie to **[Facebook Messenger](integrations/facebook.ts)** using the adapters.
