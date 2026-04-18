/**
 * fb-marie.ts
 * A high-performance Facebook AI Chatbot built with Marie and Bun-FCA.
 */

import { Agent } from '../src/agent.ts';
import { facebookAdapter } from '../integrations/facebook.ts';
import fs from 'fs';
import path from 'path';

// 1. Configure the Marie Agent
// We use the environment variables for LLM access
const agent = new Agent({
  apiKey: process.env.AI_API_KEY || '',
  baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  model: process.env.AI_MODEL || 'gpt-3.5-turbo',
  systemPrompt: `You are Marie, a sophisticated and helpful AI maid. 
  You are responding to users on Facebook Messenger. 
  Be elegant, respectful, and highly efficient. 
  Keep your responses concise but warm.`,
  safeMode: true
});

// 2. Load the AppState
const appStatePath = path.join(process.cwd(), 'bun-fca', 'appstate.json');

if (!fs.existsSync(appStatePath)) {
  console.error('❌ Error: appstate.json not found in bun-fca/appstate.json');
  console.log('Please make sure you have authenticated and saved your session state.');
  process.exit(1);
}

const appState = JSON.parse(fs.readFileSync(appStatePath, 'utf8'));

// 3. Start the Facebook Integration
console.log('🚀 Starting Marie Facebook Chatbot...');

facebookAdapter(agent, {
  appState: appState,
  startMessage: "🌸 Greetings! I am Marie, your AI assistant. How may I serve you today?",
  autoMarkRead: true,
  autoMarkDelivery: true
}).then(adapter => {
  console.log('✨ Marie is now live on Facebook Messenger!');
  
  // Handle shutdown gracefully
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    adapter.stop();
    process.exit(0);
  });
}).catch(err => {
  console.error('💥 Failed to start Facebook adapter:', err);
});
