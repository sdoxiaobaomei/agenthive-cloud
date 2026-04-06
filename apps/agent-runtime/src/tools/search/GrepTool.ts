// 代码搜索工具 - 使用 ToolEnhanced 优化版，类似 Claude Code 的 GrepTool
import { z } from 'zod'
import { buildTool, type EnhancedToolContext as ToolContext, type EnhancedPermissionDecision as PermissionDecision } from '../ToolClaudeCode.js'
import { spawn } from 'child_process'
import { resolve } from 'path'

const inputSchema = z.object({
  pattern: z.string().describe('Regular expression pattern to search for'),
  path: z.string().optional().describe('Directory or file to search in (default: workspace root)'),
  glob: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts")'),
  caseSensitive: z.boolean().optional().default(false).describe('Case sensitive search'),
  wholeWord: z.boolean().optional().default(false).describe('Match whole words only'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results to return')
})

const outputSchema = z.object({
  matches: z.array(z.object({
    file: z.string(),
    line: z.number(),
    column: z.number().optional(),
    content: z.string(),
    context: z.object({
      before: z.array(z.string()),
      after: z.array(z.string())
    }).optional()
  })),
  total: z.number(),
  truncated: z.boolean()
})

export const GrepTool = buildTool({
  name: 'grep',
  description: `Search for patterns in files using regular expressions.
Uses ripgrep (rg) if available, falls back to grep.
Returns file path, line number, and matching content.`,
  searchHint: 'search find grep pattern',
  inputSchema,
  outputSchema,
  
  // 安全标记 - 搜索操作可并发且只读
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  
  async execute(input, context: ToolContext) {
    const searchPath = input.path 
      ? resolve(context.workspacePath, input.path)
      : context.workspacePath

    const args: string[] = [
      '--line-number',
      '--column',
      '--with-filename',
      '--color=never',
      '--max-count=' + ((input.maxResults || 50) + 1),
      '--context=2' // 2 lines of context
    ]

    if (!input.caseSensitive) {
      args.push('--ignore-case')
    }

    if (input.wholeWord) {
      args.push('--word-regexp')
    }

    if (input.glob) {
      args.push('--glob', input.glob)
    }

    // 忽略常见目录
    args.push('--glob', '!node_modules/**')
    args.push('--glob', '!.git/**')
    args.push('--glob', '!dist/**')
    args.push('--glob', '!build/**')

    args.push(input.pattern)
    args.push(searchPath)

    const command = await getGrepCommand()
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: true })
      
      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('close', (code: number | null) => {
        // grep returns 1 when no matches found, which is OK
        if (code !== 0 && code !== 1) {
          context.sendLog(`Search warning: ${stderr}`, true)
        }

        const matches = parseGrepOutput(stdout, context.workspacePath)
        const maxResults = input.maxResults || 50
        const truncated = matches.length > maxResults
        
        resolve({
          matches: matches.slice(0, maxResults),
          total: matches.length,
          truncated
        })
      })

      child.on('error', (error: Error) => {
        reject(error)
      })
    })
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    const searchPath = input.path 
      ? resolve(context.workspacePath, input.path)
      : context.workspacePath
    
    // 确保搜索路径在工作空间内
    if (!searchPath.startsWith(resolve(context.workspacePath))) {
      return {
        type: 'deny',
        message: 'Search path is outside workspace'
      }
    }

    return { type: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Searching for: "${input.pattern}"${input.glob ? ` in ${input.glob} files` : ''}`
  },

  renderToolResultMessage(result) {
    if (result.total === 0) {
      return 'No matches found'
    }
    return `Found ${result.total} matches${result.truncated ? ' (truncated)' : ''}`
  },

  userFacingName(input) {
    return `Search "${input?.pattern || 'pattern'}"`
  },

  toAutoClassifierInput(input) {
    return `Search for: ${input.pattern}`
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

async function getGrepCommand(): Promise<string> {
  // 优先使用 ripgrep
  return new Promise((resolve) => {
    const check = spawn('which', ['rg'])
    check.on('close', (code) => {
      resolve(code === 0 ? 'rg' : 'grep -r')
    })
    check.on('error', () => {
      resolve('grep -r')
    })
  })
}

interface GrepMatch {
  file: string
  line: number
  column?: number
  content: string
  context?: {
    before: string[]
    after: string[]
  }
}

function parseGrepOutput(output: string, workspacePath: string): GrepMatch[] {
  const lines = output.split('\n').filter(l => l.trim())
  const matches: GrepMatch[] = []
  const contextMap = new Map<number, { before: string[]; after: string[] }>()
  
  // 解析 ripgrep/grep 输出格式: file:line:column:content 或 file-line-content
  for (const line of lines) {
    // ripgrep 格式: file:line:column:content
    const rgMatch = line.match(/^(.+):(\d+):(\d+):(.*)$/)
    if (rgMatch) {
      const [, file, lineNum, col, content] = rgMatch
      matches.push({
        file: file.replace(workspacePath, '').replace(/^\//, '') || file,
        line: parseInt(lineNum, 10),
        column: parseInt(col, 10),
        content: content.trim()
      })
      continue
    }

    // 上下文行 (以 - 或 -- 开头)
    if (line.startsWith('-') || line.startsWith('--')) {
      continue
    }

    // 简单格式: file:line:content
    const simpleMatch = line.match(/^(.+):(\d+):(.*)$/)
    if (simpleMatch) {
      const [, file, lineNum, content] = simpleMatch
      matches.push({
        file: file.replace(workspacePath, '').replace(/^\//, '') || file,
        line: parseInt(lineNum, 10),
        content: content.trim()
      })
    }
  }

  return matches
}
