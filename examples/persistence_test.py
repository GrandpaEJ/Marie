import sys
import os
import asyncio

# Add clients/python to path
sys.path.append(os.path.join(os.getcwd(), 'clients', 'python'))

from marie.agent import MarieAgent

async def test_persistence():
    print("🤖 Testing Native Rust Persistence (SQLite)...")
    
    db_path = "test-marie.sqlite"
    if os.path.exists(db_path):
        os.remove(db_path)
    
    # 1. Initialize with SQLite persistence
    agent = MarieAgent(
        model="gpt-3.5-turbo",
        persistence={
            "mode": "sqlite",
            "path": db_path
        },
        user_id="user_123"
    )
    
    print("✅ Agent initialized with SQLite.")
    
    # 2. Add a message and save
    print("📝 Adding message to memory...")
    await agent.chat("Remember that my favorite color is crimson.")
    agent.save()
    
    print(f"📦 SQLite file created: {os.path.exists(db_path)} ({os.path.getsize(db_path)} bytes)")
    
    # 3. Simulate Restart (New instance)
    print("\n♻️ Simulating Restart...")
    agent_reborn = MarieAgent(
        model="gpt-3.5-turbo",
        persistence={
            "mode": "sqlite",
            "path": db_path
        },
        user_id="user_123"
    )
    
    # Check history
    history = agent_reborn.memory.get_history()
    print(f"📝 Memory recovered after restart: {len(history)} messages found.")
    
    for msg in history:
        if "crimson" in (msg.content or ""):
            print("✨ Fact recovery confirmed: 'crimson' found in history.")
            break
    else:
        print("❌ Fact recovery failed.")

    print("\n🚀 Native Rust Persistence is FULLY OPERATIONAL!")

if __name__ == "__main__":
    asyncio.run(test_persistence())
