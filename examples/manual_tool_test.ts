import { MarieAgent } from "../clients/js/marie.ts";
import { webFetch, googleSearch } from "../tools/web.ts";

async function testTools() {
    console.log("🛠️ Starting Manual Tool Test...");

    const agent = new MarieAgent({
        safe_mode: false, // Enable shell for testing
        budget: { max_steps: 15 }
    });

    // 1. Register Host-side Tools
    console.log("\n📥 Registering JS Tools: web_fetch, google_search...");
    agent.addTool(webFetch);
    agent.addTool(googleSearch);

    // 2. Test Rust-Native Tool (Calculator)
    console.log("\n🧮 Testing Rust Tool: Calculator...");
    const calcResult = await agent.chat("Calculate (125 * 8) / 4");
    console.log(`🤖 [Marie]: ${calcResult}`);

    // 3. Test Rust-Native Tool (Shell)
    console.log("\n🐚 Testing Rust Tool: Shell...");
    const shellResult = await agent.chat("Check the current directory listing using 'ls'");
    console.log(`🤖 [Marie]: ${shellResult}`);
    
    // 4. Test Rust-Native Tool (Search)
    console.log("\n🔍 Testing Rust Tool: Web Search (Native)...");
    const searchResult = await agent.chat("Who is the current CEO of Google?");
    console.log(`🤖 [Marie]: ${searchResult}`);

    // 5. Test Rust-Native Tool (Web Fetch)
    console.log("\n📁 Testing Rust Tool: Web Fetch (Native)...");
    const nativeFetchResult = await agent.chat("Use your native web_fetch to get the content of 'https://v6.exchangerate-api.com/v6/latest/GBP' and tell me the rate for USD.");
    console.log(`🤖 [Marie]: ${nativeFetchResult}`);

    // 6. Test Host-side Tool (Web Fetch via Callback)
    console.log("\n🌐 Testing Host Tool: Web Fetch (JS Callback)...");
    const fetchResult = await agent.chat("Fetch the content of 'https://v6.exchangerate-api.com/v6/latest/USD' and tell me the rate for EUR.");
    console.log(`🤖 [Marie]: ${fetchResult}`);

    console.log("\n✅ Tool testing complete!");
}

testTools().catch(console.error);
