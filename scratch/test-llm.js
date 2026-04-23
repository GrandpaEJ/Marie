import { getLLMProvider } from '../src/llm/provider.js';
import { loadConfig } from '../src/utils/config.js';

async function test() {
  try {
    const config = loadConfig();
    const llm = getLLMProvider(config.openrouter_api_key);
    console.log("Testing LLM with model:", config.llm.defaultModel);
    
    const res = await llm.chat([{ role: 'user', content: 'Hi' }], {
      model: config.llm.defaultModel
    });
    
    console.log("Response:", res.content);
    console.log("Usage:", res.usage);
  } catch (e) {
    console.error("Test failed:", e);
  }
}

test();
