import sys
import os
import json

# Add clients/python to path
sys.path.append(os.path.join(os.getcwd(), 'clients', 'python'))

from marie.agent import MarieAgent
from marie.tools import ShellTool, WebFetchTool, FileReadTool

def main():
    print("🌸 Marie Agent - Universal Tools Demo (Modular Architecture)")
    
    api_key = os.getenv("AI_API_KEY", "your-key-here")
    
    print("\n--- [Test 1: Safe Mode (Blocked)] ---")
    agent_safe = MarieAgent(api_key=api_key, safe_mode=True)
    agent_safe.register_tool(ShellTool())
    
    is_safe = agent_safe.brain.is_tool_allowed("shell")
    print(f"Is 'shell' allowed in Safe Mode? {'Yes' if is_safe else 'No (Blocked by Rust Core)'}")

    print("\n--- [Test 2: System Integration] ---")
    agent = MarieAgent(api_key=api_key, safe_mode=False)
    
    shell = ShellTool()
    file_reader = FileReadTool()
    agent.register_tool(shell)
    agent.register_tool(file_reader)
    
    print("Registered tools in Rust core:")
    for t in agent.brain.get_tool_definitions():
        print(f" - {t.name}: {t.description} (Safe: {t.safe})")

    print("\n--- [Test 3: Direct Tool Execution] ---")
    print("Running 'whoami' via ShellTool module...")
    result = shell.run(command="whoami")
    print(f"Result:\n{result}")

    print("\n✅ Modular Tool Architecture is fully operational!")

if __name__ == "__main__":
    main()
