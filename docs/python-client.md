# Marie Python Client

The `marie` Python package is a high-level wrapper around the **Universal Rust Core**. It provides a "Pythonic" way to build agents that are fast, safe, and controllable.

## Installation

Currently, the client is included in the `clients/python` directory. To use it, ensure you have built the Rust core:

```bash
bash build.sh
```

## Basic Usage

```python
from marie.agent import MarieAgent

# Initialize the agent
agent = MarieAgent(
    api_key="your-api-key",
    model="gpt-4o",
    safe_mode=True
)

# Run a chat iteration
response = agent.chat("How can you help me today?")
print(f"Marie: {response}")
```

## Budgeting

You can enforce strict limits on your agent's spending and resource usage:

```python
agent = MarieAgent(
    api_key="...",
    budget_config={
        "max_tokens": 1000,
        "max_cost_usd": 0.05, # In USD
        "max_steps": 5        # Max tool calls per turn
    }
)
```

## Using Tools

Tools are implemented in Python but validated by the Rust core.

```python
from marie.tools import ShellTool, WebFetchTool

agent = MarieAgent(api_key="...", safe_mode=False) # Enable unsafe tools
agent.register_tool(ShellTool())
agent.register_tool(WebFetchTool())

# The agent can now use these tools automatically
response = agent.chat("What's the output of 'ls' and what's the weather on google.com?")
```

## Metrics

Monitor your agent's performance at any time:

```python
metrics = agent.get_metrics()
print(f"Total tokens used: {metrics.tokens}")
print(f"Total cost: ${metrics.cost_usd}")
```
