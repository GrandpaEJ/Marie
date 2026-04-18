import sys
import os

# Add clients/python to path so we can import it
sys.path.append(os.path.join(os.getcwd(), 'clients'))

from python import MarieAgent

def main():
    print("🌸 Marie Agent - Python + Rust Core Demo")
    
    # Configuration
    api_key = os.getenv("AI_API_KEY", "your-key-here")
    if api_key == "your-key-here":
        print("⚠️ Warning: AI_API_KEY environment variable not set. This demo will only show local logic.")
    
    # Initialize with a tight budget for testing
    agent = MarieAgent(
        api_key=api_key,
        model="gpt-3.5-turbo",
        budget_config={
            "max_tokens": 1000,
            "max_cost_usd": 0.05,
            "max_steps": 5
        }
    )
    
    agent.add_system_prompt("You are Marie, a helpful assistant powered by a Rust core.")
    
    print("\n[History in Rust Core]:")
    for msg in agent.brain.get_history():
        print(f" - {msg.role}: {msg.content}")

    # Local Logic Test (without calling the API)
    print("\n[Testing Rust Budget Enforcement]:")
    try:
        # Simulate usage
        print("Simulating 500 tokens usage...")
        agent.brain.track_usage(500, 0.01)
        
        print("Simulating another 600 tokens usage (Limit is 1000)...")
        if not agent.brain.track_usage(600, 0.01):
            print("✅ Success: Rust Core correctly blocked usage over budget!")
        
        metrics = agent.get_metrics()
        print(f"\n[Final Metrics from Rust]:")
        print(f" - Total Tokens: {metrics.tokens}")
        print(f" - Total Cost: ${metrics.cost_usd:.4f}")
        print(f" - Steps: {metrics.steps}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
