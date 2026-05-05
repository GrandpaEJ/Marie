/**
 * Production-grade Hermes Agent Loop.
 * Implements Plan->Act->Observe->Reflect pattern.
 */

import { classifyError, ErrorType, getRecoveryStrategy } from './error-handler.js';
import { lock } from './lock.js';
import { formatToolResult, truncateResult } from '../utils/output-formatter.js';

const EXCLUSIVE_TOOLS = ['manage_skills', 'make_skill', 'edit_skill', 'delete_skill', 'self_improve', 'self_restart'];

export const AgentState = {
  ANALYZING: 'ANALYZING',
  PLANNING: 'PLANNING',
  ACTING: 'ACTING',
  OBSERVING: 'OBSERVING',
  REFLECTING: 'REFLECTING',
  DONE: 'DONE'
};

const MAX_ITERATIONS = 8;
const MAX_TOKENS_BUDGET = 16000;

const PLAN_PROMPT = `Analyze the user request and plan your approach ONLY when necessary (e.g., for complex tasks or tool usage). 
If you need to plan, wrap your reasoning in <thought>...</thought> tags.
If you can answer directly without any tools or complex reasoning, just do so naturally without a thought block.

IMAGE RULES:
1. To generate or "draw" a specific image, use the [GENERATE_IMAGE: prompt] tag.
2. If the user asks for a simple anime image, you can use the [RUN_TOOL: anime] tag.
3. NEVER say you cannot generate or find images. Just use the appropriate action tag.`;

const REFLECT_PROMPT = `Review the tool results above. 
Did you get enough information to answer the user? 
If not, what is missing? Plan your next steps.
Wrap your reflection in <thought>...</thought> tags.`;

/**
 * Runs the agentic loop for a conversation turn.
 */
export async function runAgentLoop(ctx, messages, tools, llm, config) {
  const { event, mm, skills } = ctx;
  const { threadID, senderID } = event;
  
  let state = AgentState.ANALYZING;
  let iterations = 0;
  let tokensBurned = 0;
  let toolResultsHistory = [];
  let currentResponse = null;
  let fullInternalMonologue = [];
  
  // Provider fallback tracking
  const providers = [
    { model: messages[0]?.model || config.llm?.defaultModel, name: 'primary' },
    { model: config.llm?.fallbackModel || 'google/gemma-4-31b-it', name: 'fallback' }
  ];
  let currentProviderIdx = 0;

  while (iterations < MAX_ITERATIONS && state !== AgentState.DONE) {
    iterations++;
    
    let loopMessages = [...messages];
    if (iterations === 1) {
      loopMessages.push({ role: 'system', content: PLAN_PROMPT });
    } else if (state === AgentState.REFLECTING) {
      loopMessages.push({ role: 'system', content: REFLECT_PROMPT });
    }

    let response;
    try {
      const provider = providers[currentProviderIdx];
      response = await llm.chat(loopMessages, {
        model: provider.model,
        temperature: config.llm?.temperature || 0.7,
        tools: tools.length > 0 ? tools : undefined
      });
    } catch (llmError) {
      console.warn(`[AgentLoop] LLM Provider ${providers[currentProviderIdx].name} failed:`, llmError.message);
      if (currentProviderIdx < providers.length - 1) {
        currentProviderIdx++;
        console.log(`[AgentLoop] Switching to fallback provider: ${providers[currentProviderIdx].name}`);
        iterations--; // Retry this iteration with new provider
        continue;
      }
      throw llmError;
    }

    currentResponse = response;
    tokensBurned += (response.usage?.total_tokens || 0);

    if (tokensBurned > MAX_TOKENS_BUDGET) {
      console.warn(`[AgentLoop] Token budget exceeded (${tokensBurned}/${MAX_TOKENS_BUDGET}). Forcing synthesis.`);
      state = AgentState.DONE;
      break;
    }

    const content = response.content || '';
    const thoughts = extractTags(content, ['thought', 'plan', 'reflection']);
    fullInternalMonologue.push(...thoughts);

    let toolCalls = response.toolCalls || [];
    if (toolCalls.length === 0 && (content.includes('TOOLCALL>') || content.startsWith('{') || content.startsWith('['))) {
      toolCalls = parseHallucinatedToolCalls(content);
    }

    if (toolCalls.length > 0) {
      state = AgentState.ACTING;
      messages.push({ role: 'assistant', content: response.content || null, tool_calls: toolCalls });

      // Separate exclusive and parallel tools
      const exclusiveCalls = toolCalls.filter(tc => EXCLUSIVE_TOOLS.includes(tc.function.name));
      const parallelCalls = toolCalls.filter(tc => !EXCLUSIVE_TOOLS.includes(tc.function.name));

      const executeCall = async (tc) => {
        const { name, arguments: argsString } = tc.function;
        let retryCount = 0;
        
        const executeWithRetry = async () => {
          try {
            const args = JSON.parse(argsString);
            const call = async () => await skills.callTool(name, args, { threadID, senderID });
            
            if (EXCLUSIVE_TOOLS.includes(name)) {
              return await lock.withLock(name, call);
            } else {
              return await call();
            }
          } catch (err) {
            const errorType = classifyError(err);
            const strategy = getRecoveryStrategy(errorType);
            
            if (strategy.action === 'retry' && retryCount < strategy.maxRetries) {
              retryCount++;
              await new Promise(r => setTimeout(r, strategy.delay));
              return await executeWithRetry();
            }
            return { success: false, error: err.message, needs_correction: strategy.feedback };
          }
        };

        const result = await executeWithRetry();
        return { tc, result };
      };

      // 1. Execute Parallel Tools
      const parallelResults = await Promise.allSettled(parallelCalls.map(executeCall));
      
      // 2. Execute Exclusive Tools (Sequentially)
      const allResults = [];
      parallelResults.forEach(r => { if (r.status === 'fulfilled') allResults.push(r.value); });
      
      for (const tc of exclusiveCalls) {
        allResults.push(await executeCall(tc));
      }

      // 3. Process Results
      for (const { tc, result } of allResults) {
        toolResultsHistory.push(result);
        const formatted = formatToolResult(tc.function.name, result);
        const truncated = truncateResult(formatted, 3000);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: result.needs_correction ? `Error: ${result.error}. Fix your arguments.` : truncated
        });
      }

      state = AgentState.REFLECTING;
    } else {
      state = AgentState.DONE;
    }
  }

  // Final Synthesis check (if the last response was just tool results or if we need a final user-facing message)
  if (!currentResponse?.content || currentResponse.toolCalls?.length > 0) {
    // One last call to synthesize everything if the model ended on a tool call result
    currentResponse = await llm.chat(messages, {
      model,
      temperature: config.llm?.temperature || 0.7
    });
    tokensBurned += (currentResponse.usage?.total_tokens || 0);
  }

  return {
    response: currentResponse,
    tokensBurned,
    thoughts: fullInternalMonologue,
    iterations
  };
}

/**
 * Extracts content from tags like <thought>...</thought>
 */
function extractTags(text, tags) {
  const found = [];
  for (const tag of tags) {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      found.push({ tag, content: match[1].trim() });
    }
  }
  return found;
}

/**
 * Fallback parser for weaker models that hallucinate tool calls in text.
 */
function parseHallucinatedToolCalls(content) {
  try {
    let jsonPart = content;
    if (content.includes('TOOLCALL>')) {
      jsonPart = content.split('TOOLCALL>')[1].trim();
    }
    const jsonMatch = jsonPart.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!jsonMatch) return [];
    
    const parsed = JSON.parse(jsonMatch[0]);
    const toolArray = Array.isArray(parsed) ? parsed : [parsed];
    
    return toolArray.map((t, i) => ({
      id: `hallucinated_${Date.now()}_${i}`,
      type: 'function',
      function: {
        name: t.name || t.function?.name,
        arguments: typeof t.arguments === 'string' ? t.arguments : JSON.stringify(t.arguments || t.function?.arguments || {})
      }
    }));
  } catch (e) {
    return [];
  }
}
