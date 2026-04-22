/**
 * HTTP Tool - 通用 HTTP 请求工具
 */
import { z } from 'zod'
import { buildTool, type ToolContext, type EnhancedPermissionDecision as PermissionDecision } from '../ToolClaudeCode.js'

const inputSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('GET'),
  url: z.string().describe('Request URL'),
  headers: z.record(z.string()).optional().describe('Request headers'),
  body: z.string().optional().describe('Request body (for POST, PUT, PATCH)'),
  timeout: z.number().optional().default(30000).describe('Request timeout in milliseconds')
})

const outputSchema = z.object({
  statusCode: z.number(),
  statusText: z.string(),
  headers: z.record(z.string()),
  body: z.string(),
  truncated: z.boolean()
})

// URL blocklist - same as WebFetchTool
const BLOCKED_URLS = [
  /localhost/,
  /127\.\d+\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /\.internal/,
  /\.local/
]

// Read-only methods
const READONLY_METHODS = ['GET']

export const HttpTool = buildTool({
  name: 'http',
  description: `Make HTTP requests to external APIs or services.

Use this when you need to:
- Call external APIs
- Send data to webhooks
- Make authenticated requests

Warning: POST, PUT, PATCH, and DELETE methods can modify remote state.`,
  searchHint: 'http request api fetch',
  category: 'execute',
  
  inputSchema,
  outputSchema,
  
  isConcurrencySafe: (input) => READONLY_METHODS.includes(input.method!),
  isReadOnly: (input) => READONLY_METHODS.includes(input.method!),
  isDestructive: (input) => ['DELETE'].includes(input.method!),
  
  async execute(input, context: ToolContext) {
    try {
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers || {},
        body: input.body,
        signal: AbortSignal.timeout(input.timeout!)
      })

      // Get response headers
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })

      // Get response body
      let body = await response.text()
      const truncated = body.length > 50000
      if (truncated) {
        body = body.slice(0, 50000) + '\n\n[Response truncated...]'
      }

      return {
        statusCode: response.status,
        statusText: response.statusText,
        headers,
        body,
        truncated
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed'
      throw new Error(`HTTP ${input.method} failed: ${message}`)
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    // Check for blocked URLs
    for (const pattern of BLOCKED_URLS) {
      if (pattern.test(input.url)) {
        return {
          behavior: 'deny',
          message: 'Access to internal/local URLs is not allowed'
        }
      }
    }

    // Check protocol
    if (!input.url.startsWith('http://') && !input.url.startsWith('https://')) {
      return {
        behavior: 'deny',
        message: 'Only HTTP and HTTPS protocols are allowed'
      }
    }

    // Warn about write operations
    if (!READONLY_METHODS.includes(input.method!)) {
      return {
        behavior: 'ask',
        prompt: `Allow ${input.method} request to ${input.url}? This may modify remote state.`
      }
    }

    return { behavior: 'allow' }
  },

  renderToolUseMessage(input) {
    return `${input.method} ${input.url}`
  },

  renderToolResultMessage(result) {
    return `HTTP ${result.statusCode} ${result.statusText}`
  },

  userFacingName(input) {
    return `HTTP ${input?.method || 'GET'}`
  },

  toAutoClassifierInput(input) {
    return `HTTP ${input.method} ${input.url}`
  },

  classify(input) {
    if (READONLY_METHODS.includes(input.method!)) {
      return {
        category: 'execute',
        isSafe: true,
        riskLevel: 'low',
        suggestedConfirmation: false
      }
    }
    if (input.method === 'DELETE') {
      return {
        category: 'destructive',
        isSafe: false,
        riskLevel: 'high',
        suggestedConfirmation: true
      }
    }
    return {
      category: 'write',
      isSafe: false,
      riskLevel: 'medium',
      suggestedConfirmation: true
    }
  }
})
