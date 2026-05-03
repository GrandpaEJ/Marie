/**
 * Formats tool results for better presentation in observations.
 */
export function formatToolResult(toolName, result) {
  if (!result || typeof result !== 'object') return String(result);

  // If it's a search result with array of items
  if (toolName === 'search' && Array.isArray(result.results)) {
    let output = `[Search Results for "${result.query}"]\n`;
    result.results.forEach((item, i) => {
      output += `${i + 1}. **${item.title}**\n   ${item.snippet}\n   [Link](${item.link})\n`;
    });
    return output;
  }

  // Generic object formatting
  try {
    return JSON.stringify(result, null, 2);
  } catch (e) {
    return String(result);
  }
}

/**
 * Truncates long outputs and provides a summary hint.
 */
export function truncateResult(text, maxChars = 2000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[... Output truncated. Total length: ${text.length} chars ...]`;
}
