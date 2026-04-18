import asyncio
import os
from marie.agent import MarieAgent
from marie.tools import ShellTool, WebFetchTool

async def test_universal_agent():
    print("🤖 Testing Universal Marie (Rust Core)...")
    
    # We use a dummy key for initialization test
    agent = MarieAgent(
        model="gpt-4o",
        api_key="sk-test-key",
        safe_mode=True
    )
    
    # Register some tools
    agent.add_tool(ShellTool())
    agent.add_tool(WebFetchTool())
    
    print("✅ Initialization successful.")
    print(f"📦 Registered tools: {list(agent._tools.keys())}")
    
    # Check if the memory is working
    from marie.core import Message
    agent.memory.add(Message(role="user", content="Hello, machine.", tool_calls=None, tool_call_id=None))
    history = agent.memory.get_history()
    print(f"📝 Memory check: {len(history)} messages in history.")
    
    print("\n🚀 Universal Marie is ready for cross-platform deployment!")
    print("Note: Run with a real API key to test the full multi-step loop.")

if __name__ == "__main__":
    asyncio.run(test_universal_agent())
