// 文件写入工具 - 使用 ToolEnhanced 优化版
import { z } from 'zod'
import { buildTool, type EnhancedToolContext as ToolContext, type EnhancedPermissionDecision as PermissionDecision } from '../ToolClaudeCode.js'
import { writeFile, mkdir, access } from 'fs/promises'
import { dirname, resolve, isAbsolute } from 'path'

const inputSchema = z.object({
  path: z.string().describe('Absolute path to the file to write'),
  content: z.string().describe('Content to write to the file'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite existing file')
})

const outputSchema = z.object({
  success: z.boolean(),
  bytesWritten: z.number(),
  path: z.string()
})

export const FileWriteTool = buildTool({
  name: 'file_write',
  description: 'Write content to a file. Creates parent directories if they don\'t exist.',
  searchHint: 'write file create save',
  inputSchema,
  outputSchema,
  
  // 安全标记 - 写入操作不可并发，非只读，覆盖时为破坏性
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: (input) => input.overwrite === true,
  
  async execute(input, context: ToolContext) {
    const fullPath = resolveFullPath(input.path, context.workspacePath)
    
    // 检查文件是否已存在
    let exists = false
    try {
      await access(fullPath)
      exists = true
    } catch {
      exists = false
    }

    if (exists && !input.overwrite) {
      throw new Error(`File already exists: ${input.path}. Use overwrite: true to replace.`)
    }

    // 创建父目录
    const parentDir = dirname(fullPath)
    await mkdir(parentDir, { recursive: true })

    // 写入文件
    await writeFile(fullPath, input.content, 'utf-8')

    return {
      success: true,
      bytesWritten: Buffer.byteLength(input.content, 'utf-8'),
      path: input.path
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    const fullPath = resolveFullPath(input.path, context.workspacePath)
    
    // 检查是否在工作空间内
    if (!isPathWithinWorkspace(fullPath, context.workspacePath)) {
      return {
        type: 'deny',
        message: `Access denied: ${input.path} is outside workspace`
      }
    }

    // 覆盖操作需要额外确认
    return { type: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Writing file: ${input.path} (${Buffer.byteLength(input.content, 'utf-8')} bytes)${input.overwrite ? ' [overwrite]' : ''}`
  },

  renderToolResultMessage(result) {
    return `Wrote ${result.bytesWritten} bytes to ${result.path}`
  },

  userFacingName(input) {
    return `Write ${input?.path || 'file'}${input?.overwrite ? ' (overwrite)' : ''}`
  },

  toAutoClassifierInput(input) {
    return `Write file: ${input.path}${input.overwrite ? ' (overwrite)' : ''}`
  },

  classify(input) {
    return {
      category: 'write',
      isSafe: false,
      riskLevel: input.overwrite ? 'high' : 'medium',
      suggestedConfirmation: true
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
