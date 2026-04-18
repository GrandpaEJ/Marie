export const webFetch: MarieTool = {
  name: 'web_fetch',
  description: 'Fetch the text content of a URL (HTML, JSON, plain text). Use this if the standard search is not enough.',
  safe: true,
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to fetch' },
    },
    required: ['url'],
  },
  run({ url }) {
    try {
      const { spawnSync } = require("bun");
      const proc = spawnSync(["curl", "-sL", "-A", "marie-universal/1", url as string]);
      if (proc.success) {
        return proc.stdout.toString().slice(0, 15000);
      }
      return `Error: curl failed with code ${proc.exitCode}`;
    } catch (e) {
      return `Error: ${e.message}`;
    }
  },
};

export const googleSearch: MarieTool = {
  name: 'google_search',
  description: 'Search the web for real-time information. A robust JS-based search tool.',
  safe: true,
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' }
    },
    required: ['query']
  },
  run({ query }) {
    try {
        const { spawnSync } = require("bun");
        // Using DuckDuckGo Lite as a robust search backend for the JS bridge
        const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query as string)}`;
        const proc = spawnSync(["curl", "-sL", "-A", "Mozilla/5.0", searchUrl]);
        if (proc.success) {
          const html = proc.stdout.toString();
          // Extract result snippets (very basic parsing for the demo)
          const results = html.match(/<td class="result-snippet">[\s\S]*?<\/td>/g);
          if (results) {
              return results.slice(0, 5).map(r => r.replace(/<[^>]*>/g, '').trim()).join("\n---\n");
          }
          return "No search results found for this query.";
        }
        return `Error: search failed with code ${proc.exitCode}`;
    } catch (e) {
        return `Error: ${e.message}`;
    }
  }
};
