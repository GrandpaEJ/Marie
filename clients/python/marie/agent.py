import requests
import json
import logging
from .core import MarieBrain, Budget, Message, ToolCall, ToolDefinition

class MarieAgent:
    """
    Marie AI Agent - Universal Python Client.
    Uses Rust core for logic, history, and budgeting.
    Supports multi-step tool use.
    """
    def __init__(self, api_key, model="gpt-3.5-turbo", budget_config=None, safe_mode=True, base_url="https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip('/')
        self.safe_mode = safe_mode
        self.max_steps = (budget_config or {}).get('max_steps', 10)
        
        # Initialize Rust Core with Budget and Safe Mode
        rust_budget = Budget(
            max_tokens=budget_config.get('max_tokens') if budget_config else None,
            max_cost_usd=budget_config.get('max_cost_usd') if budget_config else None,
            max_steps=budget_config.get('max_steps') if budget_config else None
        )
        
        self.brain = MarieBrain(rust_budget, safe_mode)
        self._tools = {}
        self.logger = logging.getLogger("marie")

    def register_tool(self, tool_instance):
        """Register a Python-based tool into the Rust core."""
        definition = ToolDefinition(
            name=tool_instance.name,
            description=tool_instance.description,
            parameters_json=json.dumps(tool_instance.parameters),
            safe=tool_instance.safe
        )
        self.brain.register_tool(definition)
        self._tools[tool_instance.name] = tool_instance

    def add_system_prompt(self, prompt):
        self.brain.add_message(Message(role="system", content=prompt, tool_calls=None, tool_call_id=None))

    def chat(self, user_message):
        # 1. Add user message to Rust history
        self.brain.add_message(Message(role="user", content=user_message, tool_calls=None, tool_call_id=None))
        
        for step in range(self.max_steps):
            history = self.brain.get_history()
            llm_messages = []
            for m in history:
                entry = {"role": m.role, "content": m.content}
                if m.tool_calls:
                    entry["tool_calls"] = [
                        {"id": tc.id, "type": "function", "function": {"name": tc.name, "arguments": tc.arguments}}
                        for tc in m.tool_calls
                    ]
                if m.tool_call_id:
                    entry["tool_call_id"] = m.tool_call_id
                llm_messages.append(entry)

            rust_tools = self.brain.get_tool_definitions()
            openai_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": json.loads(t.parameters_json)
                    }
                } for t in rust_tools
            ] if rust_tools else None
            
            try:
                response = requests.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": llm_messages,
                        "tools": openai_tools if openai_tools else None,
                        "temperature": 0.7
                    },
                    timeout=60
                )
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                self.logger.error(f"LLM Request failed: {e}")
                raise

            choice = data['choices'][0]['message']
            content = choice.get('content')
            tool_calls_raw = choice.get('tool_calls')
            usage = data.get('usage', {})
            
            total_tokens = usage.get('total_tokens', 0)
            cost_usd = (total_tokens / 1000.0) * 0.002
            
            if not self.brain.track_usage(total_tokens, cost_usd):
                raise Exception("Budget limit exceeded!")

            if tool_calls_raw:
                rust_tool_calls = [
                    ToolCall(id=t['id'], name=t['function']['name'], arguments=t['function']['arguments'])
                    for t in tool_calls_raw
                ]
                
                self.brain.add_message(Message(
                    role="assistant", 
                    content=content, 
                    tool_calls=rust_tool_calls, 
                    tool_call_id=None
                ))
                
                for tc in rust_tool_calls:
                    if not self.brain.is_tool_allowed(tc.name):
                        result = f"Error: Tool '{tc.name}' is blocked by safe_mode."
                    else:
                        tool = self._tools.get(tc.name)
                        if not tool:
                            result = f"Error: Tool '{tc.name}' is registered in core but not found in host."
                        else:
                            try:
                                args = json.loads(tc.arguments)
                                result = tool.run(**args)
                            except Exception as e:
                                result = f"Error executing tool: {str(e)}"
                    
                    self.brain.add_message(Message(
                        role="tool", 
                        content=result, 
                        tool_calls=None, 
                        tool_call_id=tc.id
                    ))
                continue
            else:
                self.brain.add_message(Message(role="assistant", content=content, tool_calls=None, tool_call_id=None))
                return content
        
        return "Error: Maximum agent steps reached."

    def get_metrics(self):
        return self.brain.get_metrics()
