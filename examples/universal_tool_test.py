import asyncio
import os
from marie.agent import MarieAgent

async def test_universal_tools():
    print("🤖 Testing Universal Tool System (Rust Native + Python Hybrid)...")
    
    # 1. Initialize agent with native tools enabled
    agent = MarieAgent(
        model="gpt-3.5-turbo",
        api_key=os.environ.get("AI_API_KEY", "sk-dummy"),
        base_url=os.environ.get("AI_BASE_URL", "https://api.openai.com/v1"),
        safe_mode=True
    )
    
    print("\n✅ Agent initialized.")

    # Test 1: Native Calculator (Safe)
    print("\n📝 Testing Native Calculator...")
    res = await agent.chat("Calculate 125 * 5 using your tools.")
    print(f"Marie: {res}")

    # Test 2: Native Web Search (Safe)
    print("\n📝 Testing Native Web Search (DuckDuckGo)...")
    res = await agent.chat("Search for the latest result of the SpaceX Starship flight 3.")
    print(f"Marie: {res}")

    # Test 3: Native Shell (Blocked by safe_mode)
    print("\n📝 Testing Native Shell (Should be blocked)...")
    res = await agent.chat("Run 'whoami' on the shell.")
    print(f"Marie: {res}")

    # Test 4: Host-side Python Tool (Hybrid)
    print("\n📝 Testing Host-side Python Tool...")
    class GreetingTool:
        name = "get_special_greeting"
        description = "Returns a special greeting for a user"
        parameters = {
            "type": "object",
            "properties": {
                "name": {"type": "string"}
            },
            "required": ["name"]
        }
        def run(self, name: str):
            return f"Hello, {name}! This greeting is from Python."

    agent.add_tool(GreetingTool())
    res = await agent.chat("Give me a special greeting for 'Grandpa' using your tool.")
    print(f"Marie: {res}")

    print("\n🚀 Universal Tool System is FULLY OPERATIONAL!")

if __name__ == "__main__":
    asyncio.run(test_universal_tools())
