/**
 * Marie Universal Telegram Bot (Rust Core)
 * 
 * Features:
 *  - 100% Rust-Native Logic: The entire thinking loop and persistence run in Rust.
 *  - Multi-User Isolation: Each user gets a private instance via the Universal Bridge.
 *  - Native SQLite: High-performance memory storage without JS overhead.
 */

import { MarieAgent } from "../clients/js/marie";
// Note: We'll use a simple fetch-based listener to avoid external dependencies for this universal demo
const TG_TOKEN = process.env.TG_TOKEN;
const API_KEY = process.env.AI_API_KEY;

if (!TG_TOKEN) {
  console.error("❌ Set TG_TOKEN in environment.");
  process.exit(1);
}

// User instance cache: userId -> MarieAgent
const agents = new Map<number, MarieAgent>();

function getAgentForUser(userId: number): MarieAgent {
  if (!agents.has(userId)) {
    console.log(`🤖 Creating new Rust agent for user ${userId}...`);
    const agent = new MarieAgent({
      api_key: API_KEY,
      user_id: `tg_${userId}`,
      persistence: {
        mode: "sqlite",
        path: "marie-telegram-rust.sqlite"
      },
      budget: {
        max_steps: 5
      }
    });
    agents.set(userId, agent);
  }
  return agents.get(userId)!;
}

async function startBot() {
  console.log("🚀 Marie Universal Telegram Bot is starting...");
  let lastUpdateId = 0;

  while (true) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
      const data = await resp.json() as any;

      if (data.result && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          
          if (!update.message || !update.message.text) continue;
          
          const chatId = update.message.chat.id;
          const userId = update.message.from.id;
          const text = update.message.text;

          console.log(`📩 [User ${userId}]: ${text}`);

          const agent = getAgentForUser(userId);
          
          // Thinking...
          const response = await agent.chat(text);
          console.log(`🤖 [Marie]: ${response}`);

          // Send back
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: response
            })
          });
        }
      }
    } catch (e) {
      console.error("Bot Error:", e);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startBot().catch(console.error);

process.on('SIGINT', () => {
    console.log('\n👋 Closing user agent sessions...');
    for(const agent of agents.values()) {
        agent.destroy();
    }
    process.exit(0);
});
