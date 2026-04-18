import sys
import os
import asyncio

# Add clients/python to path
sys.path.append(os.path.join(os.getcwd(), 'clients', 'python'))

from marie.agent import MarieAgent

async def main():
    print("🌸 Marie Agent - Universal Rust Core Demo")
    
    api_key = os.getenv("AI_API_KEY", "your-key-here")
    
    # Initialize Agent (Logic runs in Rust)
    agent = MarieAgent(
        api_key=api_key,
        model="gpt-4o",
        budget={
            "max_tokens": 2000,
            "max_cost_usd": 0.10,
            "max_steps": 5
        },
        persistence={
            "mode": "json",
            "path": "marie-session.json"
        }
    )
    
    print("\n[Thinking with Rust Brain]...")
    response = await agent.chat("Hi Marie! Tell me a very short fun fact about Rust (the language).")
    print(f"Marie: {response}")

    metrics = agent.get_metrics()
    print(f"\n[Final Metrics from Rust]:")
    print(f" - Total Tokens: {metrics['tokens']}")
    print(f" - Total Cost: ${metrics['cost_usd']:.4f}")
    print(f" - Total Steps: {metrics['steps']}")

if __name__ == "__main__":
    asyncio.run(main())
