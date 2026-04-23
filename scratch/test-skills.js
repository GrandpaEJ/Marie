import { SkillManager } from '../marie-skills/dist/src/skill-manager.js';
import path from 'path';

async function testSkills() {
  console.log('🚀 Testing Marie-Skills System...');
  
  const skills = new SkillManager();
  const toolsPath = path.join(process.cwd(), 'marie-skills/dist/tools');
  
  console.log('📡 Loading tools...');
  await skills.loadTools(toolsPath);
  
  const tools = await skills.listTools();
  console.log(`✅ Loaded ${tools.length} tools:`, tools.map(t => t.name).join(', '));

  // Test Anime Search
  console.log('\n📡 Testing Anime Search (Real API)...');
  try {
    const result = await skills.callTool('anime', { query: 'Hatsune Miku', amount: 1 });
    console.log('✅ Anime Search Result:', JSON.stringify(result, null, 2));

    const catResult = await skills.callTool('anime', { category: 'neko', isNsfw: false });
    console.log('✅ Anime Category Result (Neko):', JSON.stringify(catResult, null, 2));

    const nsfwResult = await skills.callTool('anime', { category: 'waifu', isNsfw: true });
    console.log('✅ Anime NSFW Result (Waifu):', JSON.stringify(nsfwResult, null, 2));
  } catch (error) {
    console.error('❌ Anime Search Failed:', error.message);
  }

  // Test Calculator
  console.log('\n📡 Testing Calculator...');
  try {
    const result = await skills.callTool('calculator', { expression: '25 * 4 + 10' });
    console.log('✅ Calculator Result:', result);
  } catch (error) {
    console.error('❌ Calculator Failed:', error.message);
  }
}

testSkills();
