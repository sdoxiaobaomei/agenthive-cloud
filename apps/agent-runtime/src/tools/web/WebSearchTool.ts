/**
 * Web Search Tool - 网络搜索工具
 * 
 * 使用 DuckDuckGo 或 SerpAPI 进行搜索
 */
import { z } from 'zod'
import { buildTool, type ToolContext, type PermissionDecision } from '../ToolClaudeCode.js'

const inputSchema = z.object({
  query: z.string().describe('Search query'),
  limit: z.number().optional().default(5).describe('Maximum number of results'),
  safeSearch: z.boolean().optional().default(true).describe('Enable safe search')
})

const outputSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string()
  })),
  total: z.number(),
  query: z.string()
})

export const WebSearchTool = buildTool({
  name: 'web_search',
  description: `Search the web for information using DuckDuckGo.

Use this when you need to:
- Find current information not in your training data
- Research a topic
- Find documentation or tutorials
- Verify facts or get up-to-date information`,
  searchHint: 'search web internet duckduckgo',
  category: 'search',
  
  inputSchema,
  outputSchema,
  
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  
  async execute(input, context: ToolContext) {
    // Use DuckDuckGo HTML search
    const searchUrl = new URL('https://html.duckduckgo.com/html/')
    searchUrl.searchParams.set('q', input.query)
    if (!input.safeSearch) {
      searchUrl.searchParams.set('kp', '-1') // Disable safe search
    }

    try {
      const response = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      const html = await response.text()
      
      // Parse results (simple regex-based parsing)
      const results = parseDuckDuckGoResults(html, input.limit)

      return {
        results,
        total: results.length,
        query: input.query
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed'
      throw new Error(`Web search failed: ${message}`)
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    // Check for blocked terms
    const blockedTerms = process.env.WEB_SEARCH_BLOCKED_TERMS?.split(',') || []
    for (const term of blockedTerms) {
      if (input.query.toLowerCase().includes(term.toLowerCase())) {
        return {
          type: 'deny',
          message: `Search query contains blocked term: ${term}`
        }
      }
    }

    return { type: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Searching web for: ${input.query}`
  },

  renderToolResultMessage(result) {
    return `Found ${result.total} results for "${result.query}"`
  },

  userFacingName(input) {
    return `Search "${input?.query || 'web'}"`
  },

  toAutoClassifierInput(input) {
    return `Search web: ${input.query}`
  },

  isSearchOrReadCommand(input) {
    return { isSearch: true, isRead: true, isList: true }
  },

  classify(input) {
    return {
      category: 'search',
      isSafe: true,
      riskLevel: 'low',
      suggestedConfirmation: false
    }
  }
})

/**
 * Parse DuckDuckGo HTML results
 */
function parseDuckDuckGoResults(html: string, limit: number): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = []
  
  // Simple regex-based parsing (in production, consider using a proper HTML parser)
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g
  
  let match
  const titles: string[] = []
  const urls: string[] = []
  const snippets: string[] = []
  
  // Extract titles and URLs
  while ((match = resultRegex.exec(html)) !== null && titles.length < limit) {
    let url = match[1]
    // DuckDuckGo uses redirect URLs
    if (url.startsWith('//duckduckgo.com/l/?')) {
      const urlMatch = url.match(/uddg=([^&]*)/)
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1])
      }
    }
    urls.push(url)
    
    // Clean HTML from title
    const title = match[2].replace(/<[^>]*>/g, '')
    titles.push(title)
  }
  
  // Extract snippets
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < limit) {
    const snippet = match[1].replace(/<[^>]*>/g, '')
    snippets.push(snippet)
  }
  
  // Combine results
  for (let i = 0; i < Math.min(titles.length, limit); i++) {
    results.push({
      title: titles[i] || 'Untitled',
      url: urls[i] || '',
      snippet: snippets[i] || ''
    })
  }
  
  return results
}
