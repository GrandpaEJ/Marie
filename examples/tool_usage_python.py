import sys
import os
import asyncio

# Add clients/python to path
sys.path.append(os.path.join(os.getcwd(), 'clients', 'python'))

from marie.agent import MarieAgent
from marie.tools import ShellTool, WebFetchTool

async def main():
    print("🌸 Marie Agent - Universal Tools Demo (Rust Core)")
    
    api_key = os.getenv("AI_API_KEY", "your-key-here")
    
    # Initialize Agent in Safe Mode
    print("\n--- [Test 1: Safe Mode] ---")
    agent_safe = MarieAgent(api_key=api_key, safe_mode=True)
    agent_safe.add_tool(ShellTool())
    
    # Use the Rust brain to check allowance
    is_allowed = agent_safe.brain.is_tool_allowed("shell")
    print(f"Is 'shell' allowed in Safe Mode? {'Yes' if is_allowed else 'No (Blocked by Rust Core)'}")

    # Initialize Agent for system interaction
    print("\n--- [Test 2: System Integration] ---")
    agent = MarieAgent(api_key=api_key, safe_mode=False)
    
    agent.add_tool(ShellTool())
    agent.add_tool(WebFetchTool())
    
    print("Registered tools in Rust core:")
    for t in agent.brain.get_tool_definitions():
        print(f" - {t.name}: {t.description} (Safe: {t.safe})")

    print("\n--- [Test 3: Multi-Step Loop] ---")
    print("Marie will now use a tool to check the current user...")
    response = await agent.chat("Use the shell tool to run 'whoami' and let me know the result.")
    print(f"Marie: {response}")

    print("\n✅ Universal Tool Architecture is fully operational!")

if __name__ == "__main__":
    asyncio.run(main())
