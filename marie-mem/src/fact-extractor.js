import { upsertFact } from './storage.js';

/**
 * Extracts structured facts from the latest user message + assistant response.
 * Uses a lightweight prompt piggybacked onto the LLM.
 */

const EXTRACT_PROMPT = `Analyze the conversation below and extract any NEW facts about the user speaking.
Return ONLY a JSON array of facts. If no new facts, return [].
Each fact: {"category": "name|age|preference|relationship|location|trait|identity|other", "key": "<short label>", "value": "<concise value>"}

Rules:
- Only extract facts the USER explicitly states about themselves
- Do NOT extract facts about the bot/assistant
- Do NOT repeat facts already known (listed in existing facts)
- Keep values concise (under 20 words)
- "key" should be a short identifier like "favorite_color", "real_name", "hobby"

Examples:
User: "I'm 20 years old and I love playing Genshin Impact"
→ [{"category":"age","key":"age","value":"20 years old"},{"category":"preference","key":"game","value":"Genshin Impact"}]

User: "good morning!"
→ []`;

/**
 * Extract facts from a conversation turn.
 * @param {Object} llm - LLM provider instance
 * @param {string} userMessage - The user's message
 * @param {string} assistantResponse - The assistant's response  
 * @param {string} existingFactsBlock - Already known facts as text (to avoid dupes)
 * @param {Object} options - { model, uid, threadId }
 */
export async function extractFacts(llm, userMessage, assistantResponse, existingFactsBlock, options = {}) {
  const { uid, threadId, model } = options;

  // Skip extraction for very short messages (likely not fact-bearing)
  if (!userMessage || userMessage.length < 8) return [];

  try {
    const messages = [
      {
        role: 'system',
        content: EXTRACT_PROMPT + (existingFactsBlock ? `\n\nAlready known facts:\n${existingFactsBlock}` : '')
      },
      {
        role: 'user',
        content: `User said: "${userMessage}"\nAssistant replied: "${assistantResponse?.slice(0, 200) || ''}"`
      }
    ];

    const response = await llm.chat(messages, {
      model: model || 'google/gemma-3-8b-it:free',
      temperature: 0.1,
      max_tokens: 256
    });

    const text = response.content.trim();

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();

    // Try to find JSON array in the response
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrMatch) return [];

    const facts = JSON.parse(arrMatch[0]);
    if (!Array.isArray(facts)) return [];

    // Store each fact
    const validCategories = ['name', 'age', 'preference', 'relationship', 'location', 'trait', 'identity', 'other'];
    let stored = 0;
    for (const fact of facts) {
      if (fact.category && fact.key && fact.value) {
        let cat = fact.category.toLowerCase();
        if (!validCategories.includes(cat)) cat = 'other';
        
        upsertFact(uid, cat, fact.key, fact.value, threadId);
        stored++;
      }
    }

    if (stored > 0) {
      console.log(`[FactExtractor] Stored ${stored} new facts for user ${uid}`);
    }

    return facts;
  } catch (error) {
    // Fact extraction is non-critical — log and continue
    console.warn('[FactExtractor] Extraction failed:', error.message);
    return [];
  }
}
