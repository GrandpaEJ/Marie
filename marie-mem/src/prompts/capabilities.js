/**
 * Builds the Capabilities section of the system prompt.
 * Lists available tools with one-line descriptions.
 */
export function buildCapabilitiesSection(tools) {
  if (!tools || tools.length === 0) return '';

  let content = '[CAPABILITIES]\nYou have access to the following tools:\n';
  
  // Group tools by category if available
  const categories = {};
  tools.forEach(tool => {
    const cat = tool.category || 'general';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(tool);
  });

  for (const [cat, catTools] of Object.entries(categories)) {
    content += `\n# ${cat.toUpperCase()}\n`;
    catTools.forEach(tool => {
      content += `- ${tool.name}: ${tool.description}\n`;
    });
  }

  return content;
}
