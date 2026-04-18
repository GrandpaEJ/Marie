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
    PersistenceProvider,
    PersistenceConfig,
    Budget,
    Message,
    LtmNode,
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
            kwargs = json.loads(args)
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
        persistence: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        recent_turns: int = 10
    ):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "sk-dummy")
        self.base_url = base_url
        self.model = model
        self.user_id = user_id
        
        # 1. Initialize Rust Core Components
        budget_obj = Budget(
            max_tokens=budget.get("max_tokens") if budget else None,
            max_cost_usd=budget.get("max_cost_usd") if budget else None,
            max_steps=budget.get("max_steps") if budget else 10
        )
        
        # Persistence Config Parsing
        pers_config = PersistenceConfig.NONE()
        if persistence:
            mode = persistence.get("mode", "json")
            path = persistence.get("path", "marie-memory.json")
            if mode == "sqlite":
                pers_config = PersistenceConfig.SQLITE(path=path)
            elif mode == "json":
                pers_config = PersistenceConfig.JSON(path=path)
            elif mode == "host":
                pers_config = PersistenceConfig.HOST()

        self.brain = MarieBrain(budget=budget_obj, safe_mode=safe_mode)
        
        # Memory with persistence
        self.memory = SlidingWindowMemory(
            recent_turns=recent_turns,
            summarizer=None,
            persistence_config=pers_config,
            host_persistence=None, # Implement if mode == "host"
            user_id=self.user_id
        )
        
        self.client = LlmClient(api_key=self.api_key, base_url=self.base_url)
        
        self._tools = {}
        self.executor = PythonToolExecutor(self._tools)
        
        self._rust_agent = RustAgent(
            client=self.client,
            brain=self.brain,
            memory=self.memory,
            router=None,
            executor=self.executor,
            default_model=self.model
        )

    def add_tool(self, tool: Any):
        name = tool.name
        self._tools[name] = tool
        self.brain.register_tool(ToolDefinition(
            name=name,
            description=tool.description,
            parameters_json=json.dumps(tool.parameters),
            safe=getattr(tool, "safe", True)
        ))

    async def chat(self, message: str) -> str:
        try:
            return await self._rust_agent.chat(user_message=message)
        except Exception as e:
            return f"Agent Error: {str(e)}"

    def save(self):
        """Explicitly trigger persistence."""
        self._rust_agent.save_session()

    def get_metrics(self) -> Dict[str, Any]:
        metrics = self.brain.get_metrics()
        return {
            "tokens": metrics.tokens,
            "cost_usd": metrics.cost_usd,
            "steps": metrics.steps
        }
