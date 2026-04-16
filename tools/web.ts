// web_fetch — fetch any URL and return its text content (safe: true)
import type { Tool } from '../src/types.ts'

export const webFetch: Tool = {
  name: 'web_fetch',
  description: 'Fetch the text content of a URL (HTML, JSON, plain text)',
  safe: true,
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to fetch' },
    },
    required: ['url'],
  },
  async run({ url }) {
    const res = await fetch(url as string, { headers: { 'User-Agent': 'silvi-agent/1' } })
    if (!res.ok) return `HTTP ${res.status}`
    const text = await res.text()
    return text.slice(0, 12_000) // cap to avoid flooding context
  },
}
