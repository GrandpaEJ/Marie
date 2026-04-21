// Web search tool using DuckDuckGo instant answer API or SerpAPI
import type { Tool } from '../src/types.ts'

const DEFAULT_PROVIDER = 'duckduckgo' as const
const MAX_RESULTS = 10

interface SearchOptions {
  provider?: 'duckduckgo' | 'serpapi'
  apiKey?: string
  numResults?: number
}

interface SearchResult {
  title: string
  url: string
  snippet: string
}

async function searchDuckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&limit=${limit}`
  const res = await fetch(url)
  const data = await res.json() as any

  const results: SearchResult[] = []
  for (const item of data.RelatedTopics ?? []) {
    if (results.length >= limit) break
    if (item.Text && item.FirstURL) {
      results.push({
        title: item.Text.split(' - ')[0] || '',
        url: item.FirstURL,
        snippet: item.Text,
      })
    }
  }
  return results
}

async function searchSerpAPI(query: string, apiKey: string, limit: number): Promise<SearchResult[]> {
  const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${limit}`
  const res = await fetch(url)
  const data = await res.json() as any

  const results: SearchResult[] = []
  for (const item of data.organic_results ?? []) {
    if (results.length >= limit) break
    results.push({
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || '',
    })
  }
  return results
}

export const webSearch: Tool = {
  name: 'web_search',
  description: 'Search the web for current information. Use for facts, news, or finding URLs. Returns top results with snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
    },
    required: ['query'],
  },
  safe: true,

  async run(params: Record<string, unknown>) {
    const query = params.query as string
    if (!query) return 'Error: missing query parameter'

    const opts = params.options as SearchOptions | undefined
    const provider = opts?.provider ?? DEFAULT_PROVIDER
    const numResults = opts?.numResults ?? MAX_RESULTS

    try {
      let results: SearchResult[]

      if (provider === 'serpapi' && opts?.apiKey) {
        results = await searchSerpAPI(query, opts.apiKey, numResults)
      } else {
        results = await searchDuckDuckGo(query, numResults)
      }

      if (results.length === 0) {
        return 'No results found.'
      }

      const formatted = results.map((r, i) =>
        `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`
      ).join('\n\n')

      return `Search results for "${query}":\n\n${formatted}`
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Search error: ${msg}`
    }
  },
}