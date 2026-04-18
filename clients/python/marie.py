import os
import requests
import json
import logging
from .marie_core import MarieBrain, Budget, Message, Metrics

class MarieAgent:
    """
    Marie AI Agent - Universal Python Client.
    Uses Rust core for logic, history, and budgeting.
    """
    def __init__(self, api_key, model="gpt-3.5-turbo", budget_config=None, base_url="https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip('/')
        
        # Initialize Rust Core with Budget
        rust_budget = Budget(
            max_tokens=budget_config.get('max_tokens') if budget_config else None,
            max_cost_usd=budget_config.get('max_cost_usd') if budget_config else None,
            max_steps=budget_config.get('max_steps') if budget_config else None
        )
        
        self.brain = MarieBrain(rust_budget)
        self.logger = logging.getLogger("marie")

    def add_system_prompt(self, prompt):
        self.brain.add_message("system", prompt)

    def chat(self, message):
        # 1. Add user message to Rust history
        self.brain.add_message("user", message)
        
        # 2. Extract history from Rust to send to LLM
        history = self.brain.get_history()
        llm_messages = [{"role": m.role, "content": m.content} for m in history]
        
        # 3. Perform IO (LLM Request)
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": llm_messages
                },
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            self.logger.error(f"LLM Request failed: {e}")
            raise

        # 4. Extract result and usage
        choice = data['choices'][0]['message']
        text = choice.get('content')
        usage = data.get('usage', {})
        
        prompt_tokens = usage.get('prompt_tokens', 0)
        comp_tokens = usage.get('completion_tokens', 0)
        total_tokens = usage.get('total_tokens', 0)

        # 5. Calculate Cost (Simplified logic, can be improved in Rust later)
        # Assuming $0.002 per 1k tokens for demo
        cost_usd = (total_tokens / 1000.0) * 0.002
        
        # 6. Track and Enforce Budget in Rust
        if not self.brain.track_usage(total_tokens, cost_usd):
            raise Exception("Budget limit exceeded! Terminating request.")

        # 7. Add assistant response back to Rust history
        self.brain.add_message("assistant", text)
        
        return text

    def get_metrics(self) -> Metrics:
        return self.brain.get_metrics()
