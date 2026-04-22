// 文件读取工具 - 使用 ToolEnhanced 优化版
import { z } from 'zod'
import { buildTool, type EnhancedToolContext as ToolContext, type EnhancedPermissionDecision as PermissionDecision } from '../ToolClaudeCode.js'
import { readFile, access } from 'fs/promises'
import { resolve, isAbsolute } from 'path'

const inputSchema = z.object({
  path: z.string().describe('Absolute path to the file to read'),
  offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
  limit: z.number().optional().describe('Maximum number of lines to read')
})

const outputSchema = z.object({
  content: z.string().describe('File content'),
  lines: z.number().describe('Total number of lines in the file'),
  truncated: z.boolean().describe('Whether the content was truncated')
})

export const FileReadTool = buildTool({
  name: 'file_read',
  description: 'Read the contents of a file. Can read partial content with offset and limit.',
  searchHint: 'read file content text',
  inputSchema,
  outputSchema,
  
  // 安全标记 - 读取操作可并发且只读
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  
  async execute(input, context: ToolContext) {
    const fullPath = resolveFullPath(input.path, context.workspacePath)
    
    // 检查文件是否存在
    try {
      await access(fullPath)
    } catch {
      throw new Error(`File not found: ${input.path}`)
    }

    // 读取文件内容
    const content = await readFile(fullPath, 'utf-8')
    const allLines = content.split('\n')
    const totalLines = allLines.length

    // 处理偏移和限制
    const offset = input.offset ? Math.max(1, input.offset) : 1
    const limit = input.limit ? Math.min(input.limit, 1000) : totalLines
    
    const startIndex = offset - 1
    const endIndex = Math.min(startIndex + limit, totalLines)
    const selectedLines = allLines.slice(startIndex, endIndex)
    
    const result = {
      content: selectedLines.join('\n'),
      lines: totalLines,
      truncated: endIndex < totalLines
    }

    return result
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    const fullPath = resolveFullPath(input.path, context.workspacePath)
    
    // 检查是否在工作空间内
    if (!isPathWithinWorkspace(fullPath, context.workspacePath)) {
      return {
        behavior: 'deny',
        message: `Access denied: ${input.path} is outside workspace`
      }
    }

    return { behavior: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Reading file: ${input.path}${input.offset ? ` (from line ${input.offset})` : ''}`
  },

  renderToolResultMessage(result) {
    if (result.truncated) {
      return `Read ${result.lines} lines total (truncated)`
    }
    return `Read ${result.lines} lines`
  },

  userFacingName(input) {
    return `Read ${input?.path || 'file'}`
  },

  toAutoClassifierInput(input) {
    return `Read file: ${input.path}`
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

// 辅助函数
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
