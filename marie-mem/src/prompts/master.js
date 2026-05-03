import { buildIdentitySection } from './identity.js';
import { buildCapabilitiesSection } from './capabilities.js';
import { buildToolProtocol } from './protocol.js';
import { buildReasoningProtocol } from './reasoning.js';
import { buildContextSection } from './context.js';

/**
 * Master System Prompt Builder.
 * Orchestrates modular components into a cohesive system instruction.
 */
export function buildMasterPrompt(ctx) {
  const { 
    persona, 
    userName, 
    tools = [], 
    providerUsed = 'openai', 
    userFacts = '', 
    sessionContext = '',
    platform = 'telegram'
  } = ctx;

  const sections = [
    buildIdentitySection(persona, userName),
    buildContextSection(userFacts, sessionContext),
    buildCapabilitiesSection(tools),
    buildToolProtocol(providerUsed),
    buildReasoningProtocol(),
    `[OUTPUT FORMAT]
- Use Markdown for formatting.
- If you have an image URL, use this syntax: ![image](url)
- Keep responses concise but helpful. 
- You are on ${platform}, so adjust your tone accordingly.`
  ];

  return sections.filter(s => !!s).join('\n\n---\n\n');
}
