import sys
import os

# Add clients/python to path so we can import 'marie'
sys.path.append(os.path.join(os.getcwd(), 'clients', 'python'))

from marie.agent import MarieAgent

def main():
    print("🌸 Marie Agent - Python + Rust Core Demo (Modular)")
    
    api_key = os.getenv("AI_API_KEY", "your-key-here")
    
    agent = MarieAgent(
        api_key=api_key,
        model="gpt-3.5-turbo",
        budget_config={
            "max_tokens": 1000,
            "max_cost_usd": 0.05,
            "max_steps": 5
        }
    )
    
    agent.add_system_prompt("You are Marie, a helpful assistant powered by a modular Rust core.")
    
    print("\n[History in Rust Core]:")
    for msg in agent.brain.get_history():
        print(f" - {msg.role}: {msg.content}")

    print("\n[Testing Rust Budget Enforcement]:")
    print("Simulating tokens usage...")
    agent.brain.track_usage(1100, 0.01)
    
    metrics = agent.get_metrics()
    print(f"\n[Final Metrics from Rust]:")
    print(f" - Total Tokens: {metrics.tokens}")
    print(f" - Total Cost: ${metrics.cost_usd:.4f}")

if __name__ == "__main__":
    main()
