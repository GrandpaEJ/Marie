import os
import json
import asyncio
from typing import List, Optional, Dict, Any
from .core import (
    MarieAgent as RustAgent,
    MarieBrain,
    LlmClient,
    ModelRouter,
    SlidingWindowMemory,
    ToolExecutor,
    Budget,
    Message,
    ToolDefinition,
    ModelTier
)

class PythonToolExecutor(ToolExecutor):
    """Bridges Rust tool calls to Python tool implementations."""
    def __init__(self, tools: Dict[str, Any]):
        self.tools = tools

    def execute(self, name: str, args: str) -> str:
        try:
            tool = self.tools.get(name)
            if not tool:
                return f"Error: Tool '{name}' not found."
            
            # Parse arguments (Rust passes them as a JSON string)
            kwargs = json.loads(args)
            
            # Execute tool (sync for now as Rust expects a sync return)
            # In a mature implementation, this would handle async tools via a proxy
            result = tool.run(**kwargs)
            return str(result)
        except Exception as e:
            return f"Error executing tool '{name}': {str(e)}"

class MarieAgent:
    def __init__(
        self,
        model: str = "gpt-4o",
        api_key: Optional[str] = None,
        base_url: str = "https://api.openai.com/v1",
        safe_mode: bool = True,
        budget: Optional[Dict[str, Any]] = None,
        recent_turns: int = 10
    ):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "sk-dummy")
        self.base_url = base_url
        self.model = model
        
        # 1. Initialize Rust Core Components
        budget_obj = Budget(
            max_tokens=budget.get("max_tokens") if budget else None,
            max_cost_usd=budget.get("max_cost_usd") if budget else None,
            max_steps=budget.get("max_steps") if budget else 10
        )
        
        self.brain = MarieBrain(budget=budget_obj, safe_mode=safe_mode)
        self.memory = SlidingWindowMemory(recent_turns=recent_turns, summarizer=None)
        self.client = LlmClient(api_key=self.api_key, base_url=self.base_url)
        
        # 2. Tool Registry (Python side)
        self._tools = {}
        self.executor = PythonToolExecutor(self._tools)
        
        # 3. The Rust Agent Loop
        # Note: We pass the router as None for now, as we use the default model.
        # router = ModelRouter(...) can be added later if needed.
        self._rust_agent = RustAgent(
            client=self.client,
            brain=self.brain,
            memory=self.memory,
            router=None,
            executor=self.executor,
            default_model=self.model
        )

    def add_tool(self, tool: Any):
        """Register a tool with both the Python executor and the Rust brain."""
        name = tool.name
        self._tools[name] = tool
        
        # Register with Rust brain for LLM visibility
        self.brain.register_tool(ToolDefinition(
            name=name,
            description=tool.description,
            parameters_json=json.dumps(tool.parameters),
            safe=getattr(tool, "safe", True)
        ))

    async def chat(self, message: str) -> str:
        """The entire multi-step loop is now handled by the Rust core."""
        try:
            # We call the async Rust method
            return await self._rust_agent.chat(user_message=message)
        except Exception as e:
            return f"Agent Error: {str(e)}"

    def get_metrics(self) -> Dict[str, Any]:
        metrics = self.brain.get_metrics()
        return {
            "tokens": metrics.tokens,
            "cost_usd": metrics.cost_usd,
            "steps": metrics.steps
        }
