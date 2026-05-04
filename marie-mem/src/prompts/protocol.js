/**
 * Builds the Tool Protocol section of the system prompt.
 * Instructs the model on how to call tools.
 */
export function buildToolProtocol(providerUsed) {
  const isNative = providerUsed === 'openai' || providerUsed === 'primary';
  
  let content = '[TOOL PROTOCOL]\n';
  
  if (isNative) {
    content += `Use your native tool-calling interface to execute functions. 
Always provide the required arguments as defined in the tool schema.`;
  } else {
    content += `Your current interface DOES NOT support native function calling. 
To call a tool, you MUST use the following format on a NEW LINE:

TOOLCALL>{"name": "tool_name", "arguments": {"arg1": "value"}}

CRITICAL RULES:
1. Every tool call MUST be prefixed with "TOOLCALL>".
2. The argument block MUST be valid JSON.
3. If you need to generate an image, you MUST call "generate_image".
4. Never tell the user you cannot do something if a tool exists for it.

Example: 
TOOLCALL>{"name": "generate_image", "arguments": {"prompt": "cute anime girl with cat ears"}}`;
  }

  return content;
}
