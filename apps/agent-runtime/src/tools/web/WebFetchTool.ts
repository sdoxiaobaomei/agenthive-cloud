/**
 * Web Fetch Tool - 网页内容获取工具
 */
import { z } from 'zod'
import { buildTool, type ToolContext, type PermissionDecision } from '../ToolClaudeCode.js'

const inputSchema = z.object({
  url: z.string().describe('URL to fetch'),
  maxLength: z.number().optional().default(10000).describe('Maximum content length to return'),
  timeout: z.number().optional().default(30000).describe('Request timeout in milliseconds')
})

const outputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string().describe('Extracted text content'),
  contentType: z.string().optional(),
  statusCode: z.number(),
  truncated: z.boolean()
})

// URL blocklist
const BLOCKED_URLS = [
  /localhost/,
  /127\.\d+\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /\.internal/,
  /\.local/
]

export const WebFetchTool = buildTool({
  name: 'web_fetch',
  description: `Fetch and extract content from a web page.

Use this when you need to:
- Read documentation from a URL
- Extract article content
- Get information from a specific webpage

Note: JavaScript-rendered content may not be fully captured.`,
  searchHint: 'fetch webpage url content',
  category: 'read',
  
  inputSchema,
  outputSchema,
  
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  
  async execute(input, context: ToolContext) {
    try {
      const response = await fetch(input.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentRuntime/2.0)'
        },
        signal: AbortSignal.timeout(input.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || 'text/html'
      const html = await response.text()
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : undefined
      
      // Extract readable content
      let content = extractReadableContent(html)
      
      // Truncate if needed
      const truncated = content.length > input.maxLength
      if (truncated) {
        content = content.slice(0, input.maxLength) + '\n\n[Content truncated...]'
      }

      return {
        url: input.url,
        title,
        content,
        contentType,
        statusCode: response.status,
        truncated
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fetch failed'
      throw new Error(`Failed to fetch ${input.url}: ${message}`)
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    // Check for blocked URLs
    for (const pattern of BLOCKED_URLS) {
      if (pattern.test(input.url)) {
        return {
          type: 'deny',
          message: 'Access to internal/local URLs is not allowed'
        }
      }
    }

    // Check protocol
    if (!input.url.startsWith('http://') && !input.url.startsWith('https://')) {
      return {
        type: 'deny',
        message: 'Only HTTP and HTTPS protocols are allowed'
      }
    }

    return { type: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Fetching: ${input.url}`
  },

  renderToolResultMessage(result) {
    if (result.truncated) {
      return `Fetched ${result.url} (truncated)`
    }
    return `Fetched ${result.url}`
  },

  userFacingName(input) {
    return `Fetch ${input?.url || 'URL'}`
  },

  toAutoClassifierInput(input) {
    return `Fetch URL: ${input.url}`
  },

  classify(input) {
    return {
      category: 'read',
      isSafe: true,
      riskLevel: 'low',
      suggestedConfirmation: false
    }
  }
})

/**
 * Extract readable content from HTML
 */
function extractReadableContent(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
  
  // Try to find main content
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                   text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                   text.match(/<div[^>]*class=["'][^"']*(?:content|main)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  
  if (mainMatch) {
    text = mainMatch[1]
  }
  
  // Convert remaining HTML to text
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#[0-9]+;/g, (match) => {
      const code = parseInt(match.slice(2, -1), 10)
      return String.fromCharCode(code)
    })
  
  // Clean up whitespace
  text = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
  
  return text
}
