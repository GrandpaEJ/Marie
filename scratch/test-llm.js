import { LLMProvider, countTokens } from '../marie-llm/dist/index.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('❌ OPENROUTER_API_KEY not found in .env');
  process.exit(1);
}

async function runTest() {
  console.log('🚀 Testing Marie-LLM Optimized SDK...');

  // 1. Test Tokenizer
  const text = "Hello Marie! How are you today?";
  const tokens = countTokens(text);
  console.log(`📊 Tokenizer Test: "${text}" -> ${tokens} tokens`);

  // 2. Test LLM Client
  const llm = new LLMProvider(apiKey);
  
  try {
    console.log('📡 Calling LLM (Cache Miss)...');
    const start1 = Date.now();
    const res1 = await llm.chat([
      { role: 'user', content: 'What is 2+2? Answer in one word.' }
    ]);
    const end1 = Date.now();
    console.log(`✅ Response 1: "${res1.content}" (${res1.usage?.total_tokens} tokens) - ${end1 - start1}ms`);

    // 3. Test Cache (Hit)
    console.log('📡 Calling LLM (Cache Hit)...');
    const start2 = Date.now();
    const res2 = await llm.chat([
      { role: 'user', content: 'What is 2+2? Answer in one word.' }
    ]);
    const end2 = Date.now();
    console.log(`✅ Response 2: "${res2.content}" (CACHED) - ${end2 - start2}ms`);

    if (end2 - start2 < 10) {
      console.log('🌟 CACHE WORKING PERFECTLY!');
    }

  } catch (error) {
    console.error('❌ LLM Test Failed:', error.message);
  } finally {
    await llm.destroy();
    console.log('🏁 Test Complete.');
  }
}

runTest();
