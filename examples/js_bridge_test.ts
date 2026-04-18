import { MarieAgent } from "../clients/js/marie";

async function testBridge() {
  console.log("🤖 Testing Universal JS Bridge (Bun FFI)...");

  try {
    const agent = new MarieAgent({
      model: "gpt-3.5-turbo",
      safe_mode: true,
      persistence: {
        mode: "json",
        path: "js-session.json"
      }
    });

    console.log("✅ Agent initialized via Rust FFI.");

    console.log("📝 Sending message to Rust core...");
    const response = await agent.chat("Hi! Just verifying you are running from the Rust Universal Core.");
    console.log(`Marie: ${response}`);

    agent.destroy();
    console.log("\n🚀 JS/Bun Universal Bridge is FULLY OPERATIONAL!");
  } catch (error) {
    console.error("❌ Bridge initialization failed:", error);
  }
}

testBridge();
