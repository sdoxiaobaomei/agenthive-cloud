// 文件编辑工具 - 使用 ToolEnhanced 优化版，支持类似 Claude Code 的字符串替换
import { z } from 'zod'
import { buildTool, type EnhancedToolContext as ToolContext, type EnhancedPermissionDecision as PermissionDecision } from '../ToolClaudeCode.js'
import { readFile, writeFile } from 'fs/promises'
import { resolve, isAbsolute } from 'path'

const inputSchema = z.object({
  path: z.string().describe('Absolute path to the file to edit'),
  oldString: z.string().describe('String to replace (must match exactly)'),
  newString: z.string().describe('Replacement string'),
  replaceAll: z.boolean().optional().default(false).describe('Replace all occurrences')
})

const outputSchema = z.object({
  success: z.boolean(),
  replacements: z.number(),
  path: z.string()
})

export const FileEditTool = buildTool({
  name: 'file_edit',
  description: `Edit a file by replacing a specific string with another string. 
The oldString must match exactly (including whitespace and indentation).
Use this for precise edits to existing files.`,
  searchHint: 'edit file replace modify',
  inputSchema,
  outputSchema,
  
  // 安全标记 - 编辑操作不可并发，非只读，非破坏性（有备份机制）
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  
  async execute(input, context: ToolContext) {
    const fullPath = resolveFullPath(input.path, context.workspacePath)
    
    // 读取文件内容
    let content: string
    try {
      content = await readFile(fullPath, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to read file: ${input.path}`)
    }

    // 检查 oldString 是否存在
    if (!content.includes(input.oldString)) {
      throw new Error(
        `String not found in file. The oldString must match exactly.\n` +
        `Looking for: ${input.oldString.slice(0, 50)}...`
      )
    }

    // 执行替换
    let newContent: string
    let replacements: number
    
    if (input.replaceAll) {
      const matches = content.match(new RegExp(escapeRegExp(input.oldString), 'g'))
      replacements = matches?.length || 0
      newContent = content.split(input.oldString).join(input.newString)
    } else {
      // 只替换第一个匹配
      const index = content.indexOf(input.oldString)
      if (index === -1) {
        throw new Error('String not found')
      }
      newContent = 
        content.substring(0, index) + 
        input.newString + 
        content.substring(index + input.oldString.length)
      replacements = 1
    }

    // 写入文件
    await writeFile(fullPath, newContent, 'utf-8')

    return {
      success: true,
      replacements,
      path: input.path
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    const fullPath = resolveFullPath(input.path, context.workspacePath)
    
    if (!isPathWithinWorkspace(fullPath, context.workspacePath)) {
      return {
        behavior: 'deny',
        message: `Access denied: ${input.path} is outside workspace`
      }
    }

    return { behavior: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Editing file: ${input.path}${input.replaceAll ? ' (replace all)' : ''}`
  },

  renderToolResultMessage(result) {
    return `Made ${result.replacements} replacement(s) in ${result.path}`
  },

  userFacingName(input) {
    return `Edit ${input?.path || 'file'}`
  },

  toAutoClassifierInput(input) {
    return `Edit file: ${input.path}`
  },

  classify(input) {
    return {
      category: 'edit',
      isSafe: false,
      riskLevel: 'medium',
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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
