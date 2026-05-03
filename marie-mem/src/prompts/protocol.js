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
To call a tool, you MUST start your message with a JSON block in the following format:
TOOLCALL>{"name": "tool_name", "arguments": {"arg1": "value"}}

Example: 
TOOLCALL>{"name": "datetime", "arguments": {}}`;
  }

  return content;
}
