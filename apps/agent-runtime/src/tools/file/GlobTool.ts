/**
 * Glob Tool - 文件模式匹配工具
 */
import { z } from 'zod'
import { buildTool, type ToolContext, type PermissionDecision } from '../ToolClaudeCode.js'
import fastGlob from 'fast-glob'
import { resolve, isAbsolute, relative } from 'path'

const inputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "src/**/*.ts")'),
  cwd: z.string().optional().describe('Working directory for the search'),
  ignore: z.array(z.string()).optional().describe('Patterns to ignore'),
  limit: z.number().optional().default(100).describe('Maximum number of results')
})

const outputSchema = z.object({
  files: z.array(z.string()).describe('Matched file paths'),
  count: z.number().describe('Total number of matches'),
  truncated: z.boolean().describe('Whether results were truncated')
})

export const GlobTool = buildTool({
  name: 'glob',
  description: `Find files matching a glob pattern. Supports standard glob syntax including:
- * (match any characters except /)
- ** (match any characters including /)
- ? (match single character)
- {a,b} (match a or b)

Examples:
- "src/**/*.ts" - all TypeScript files in src
- "*.{js,ts}" - all JS and TS files in current directory
- "**/*.test.ts" - all test files`,
  searchHint: 'find files glob pattern search',
  category: 'search',
  
  inputSchema,
  outputSchema,
  
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  
  async execute(input, context: ToolContext) {
    const cwd = input.cwd 
      ? resolveFullPath(input.cwd, context.workspacePath)
      : context.workspacePath

    const files = await fastGlob(input.pattern, {
      cwd,
      ignore: input.ignore || ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      absolute: false,
      limit: input.limit + 1 // Get one extra to check if truncated
    })

    const truncated = files.length > input.limit
    const results = files.slice(0, input.limit)

    // Convert to relative paths from workspace
    const relativeFiles = results.map(f => {
      const fullPath = isAbsolute(f) ? f : resolve(cwd, f)
      return relative(context.workspacePath, fullPath)
    })

    return {
      files: relativeFiles,
      count: relativeFiles.length,
      truncated
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    const cwd = input.cwd 
      ? resolveFullPath(input.cwd, context.workspacePath)
      : context.workspacePath

    if (!isPathWithinWorkspace(cwd, context.workspacePath)) {
      return {
        type: 'deny',
        message: `Access denied: cwd is outside workspace`
      }
    }

    return { type: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Searching for: ${input.pattern}`
  },

  renderToolResultMessage(result) {
    if (result.truncated) {
      return `Found ${result.count}+ files (truncated)`
    }
    return `Found ${result.count} files`
  },

  userFacingName(input) {
    return `Glob ${input?.pattern || 'files'}`
  },

  toAutoClassifierInput(input) {
    return `Find files: ${input.pattern}`
  },

  isSearchOrReadCommand(input) {
    return { isSearch: true, isRead: false, isList: true }
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

function resolveFullPath(inputPath: string, workspacePath: string): string {
  if (isAbsolute(inputPath)) {
    return inputPath
  }
  return resolve(workspacePath, inputPath)
}

function isPathWithinWorkspace(fullPath: string, workspacePath: string): boolean {
  const resolvedWorkspace = resolve(workspacePath)
  const resolvedPath = resolve(fullPath)
  return resolvedPath.startsWith(resolvedWorkspace)
}
