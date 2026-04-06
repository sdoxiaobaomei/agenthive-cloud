/**
 * Enhanced File Read Tool - 优化的文件读取工具
 * 
 * 参考 Claude Code 设计优化：
 * 1. 使用 TOOL_DEFAULTS 模式
 * 2. 标记为并发安全（读取操作）
 * 3. 标记为只读操作
 * 4. 添加搜索提示和别名
 * 5. 用户友好的渲染方法
 */

import { z } from 'zod'
import { buildTool, PermissionDecision } from '../ToolEnhanced.js'
import { readFile } from '../../utils/file.js'
import { resolvePath } from '../../utils/path.js'

// ============================================================================
// Schema 定义
// ============================================================================

const FileReadInput = z.object({
  path: z.string().describe('The path to the file to read'),
  offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
  limit: z.number().optional().describe('Maximum number of lines to read'),
}).describe('Read the contents of a file')

const FileReadOutput = z.object({
  content: z.string().describe('The file contents'),
  path: z.string().describe('The resolved file path'),
  totalLines: z.number().describe('Total number of lines in the file'),
  linesRead: z.number().describe('Number of lines actually read'),
})

export type FileReadInput = z.infer<typeof FileReadInput>
export type FileReadOutput = z.infer<typeof FileReadOutput>

// ============================================================================
// 文件读取工具
// ============================================================================

export const FileReadTool = buildTool({
  // 基本信息
  name: 'file_read',
  description: 'Read the contents of a file. Use this to examine code, config files, or any text file. Supports reading specific line ranges with offset and limit.',
  
  // Schema
  inputSchema: FileReadInput,
  outputSchema: FileReadOutput,
  
  // 元数据 - 参考 Claude Code 设计
  aliases: ['read', 'cat', 'view'],  // 向后兼容的别名
  searchHint: 'view file contents read text',  // 工具发现提示
  maxResultSizeChars: 100000,  // 100KB，大文件截断
  
  // 行为特性 - 读取操作是并发安全的
  isConcurrencySafe: () => true,  // 读取操作可以并行
  isReadOnly: () => true,         // 不修改任何状态
  isDestructive: () => false,     // 非破坏性
  
  // 用户友好的名称
  userFacingName: (input) => {
    if (input?.path) {
      return `Reading ${input.path}`
    }
    return 'file_read'
  },
  
  // 自动分类器输入（用于安全模式）
  toAutoClassifierInput: (input) => `Read ${input.path}`,
  
  // 权限检查
  checkPermissions: async (input, context): Promise<PermissionDecision> => {
    try {
      const fullPath = resolvePath(input.path, context.workspacePath)
      
      // 检查是否在允许的路径内
      if (!fullPath.startsWith(context.workspacePath)) {
        return {
          type: 'deny',
          message: `Cannot read files outside workspace: ${input.path}`
        }
      }
      
      return { type: 'allow' }
    } catch (error) {
      return {
        type: 'deny',
        message: `Invalid path: ${input.path}`
      }
    }
  },
  
  // 核心执行
  execute: async (input, context): Promise<FileReadOutput> => {
    const fullPath = resolvePath(input.path, context.workspacePath)
    
    context.sendLog(`Reading file: ${input.path}`)
    
    const content = await readFile(fullPath, {
      offset: input.offset,
      limit: input.limit
    })
    
    const lines = content.split('\n')
    
    return {
      content,
      path: fullPath,
      totalLines: lines.length,
      linesRead: lines.length
    }
  },
  
  // 渲染方法
  renderToolUseMessage: (input) => {
    let msg = `📖 Reading: ${input.path}`
    if (input.offset || input.limit) {
      const range = []
      if (input.offset) range.push(`from line ${input.offset}`)
      if (input.limit) range.push(`${input.limit} lines`)
      msg += ` (${range.join(', ')})`
    }
    return msg
  },
  
  renderToolResultMessage: (result) => {
    const size = result.content.length
    const sizeStr = size > 1024 
      ? `${(size / 1024).toFixed(1)}KB` 
      : `${size}B`
    return `✓ Read ${sizeStr}, ${result.totalLines} lines`
  }
})

// ============================================================================
// Glob 工具 - 同样并发安全
// ============================================================================

import { glob } from '../../utils/glob.js'

const GlobInput = z.object({
  pattern: z.string().describe('Glob pattern to match files'),
  path: z.string().optional().describe('Directory to search in (defaults to workspace)'),
}).describe('Find files matching a glob pattern')

const GlobOutput = z.object({
  files: z.array(z.string()).describe('Matching file paths'),
  count: z.number().describe('Number of matches'),
})

export const GlobTool = buildTool({
  name: 'glob',
  description: 'Find files matching a glob pattern. Supports * and ** wildcards. Use this to locate files by name or extension.',
  
  inputSchema: GlobInput,
  outputSchema: GlobOutput,
  
  aliases: ['find', 'ls'],
  searchHint: 'find files glob pattern search',
  
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  
  userFacingName: (input) => input?.pattern ? `Finding ${input.pattern}` : 'glob',
  toAutoClassifierInput: (input) => `Glob ${input.pattern}`,
  
  execute: async (input, context) => {
    const searchPath = input.path 
      ? resolvePath(input.path, context.workspacePath)
      : context.workspacePath
    
    context.sendLog(`Searching: ${input.pattern}`)
    
    const files = await glob(input.pattern, { cwd: searchPath })
    
    return {
      files: files.slice(0, 100),  // 限制结果数量
      count: files.length
    }
  },
  
  renderToolUseMessage: (input) => `🔍 Glob: ${input.pattern}`,
  renderToolResultMessage: (result) => `✓ Found ${result.count} files`
})

// ============================================================================
// 文件写入工具 - 非并发安全
// ============================================================================

import { writeFile } from '../../utils/file.js'

const FileWriteInput = z.object({
  path: z.string().describe('The path to write to'),
  content: z.string().describe('The content to write'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite existing file'),
})

const FileWriteOutput = z.object({
  path: z.string(),
  bytesWritten: z.number(),
  isNew: z.boolean(),
})

export const FileWriteTool = buildTool({
  name: 'file_write',
  description: 'Write content to a file. Creates the file if it does not exist. Use overwrite:true to replace existing files.',
  
  inputSchema: FileWriteInput,
  outputSchema: FileWriteOutput,
  
  aliases: ['write'],
  searchHint: 'write file create save',
  
  // 写入操作 - 非并发安全
  isConcurrencySafe: () => false,  // 写入不能并行
  isReadOnly: () => false,         // 会修改状态
  isDestructive: (input) => input.overwrite === true,  // 覆盖是破坏性的
  
  userFacingName: (input) => input?.path ? `Writing ${input.path}` : 'file_write',
  toAutoClassifierInput: (input) => `Write ${input.path}${input.overwrite ? ' (overwrite)' : ''}`,
  
  checkPermissions: async (input, context) => {
    const fullPath = resolvePath(input.path, context.workspacePath)
    
    if (!fullPath.startsWith(context.workspacePath)) {
      return {
        type: 'deny',
        message: `Cannot write files outside workspace: ${input.path}`
      }
    }
    
    // 检查是否覆盖
    if (input.overwrite) {
      return {
        type: 'ask',
        prompt: `Overwrite existing file: ${input.path}?`
      }
    }
    
    return { type: 'allow' }
  },
  
  execute: async (input, context) => {
    const fullPath = resolvePath(input.path, context.workspacePath)
    
    context.sendLog(`Writing file: ${input.path}`)
    
    await writeFile(fullPath, input.content)
    
    return {
      path: fullPath,
      bytesWritten: input.content.length,
      isNew: true
    }
  },
  
  renderToolUseMessage: (input) => `✏️ Writing: ${input.path}${input.overwrite ? ' (overwrite)' : ''}`,
  renderToolResultMessage: (result) => `✓ Written ${result.bytesWritten} bytes to ${result.path}`
})

// ============================================================================
// 文件编辑工具 - 非并发安全
// ============================================================================

import { editFile } from '../../utils/file.js'

const FileEditInput = z.object({
  path: z.string().describe('The file to edit'),
  oldString: z.string().describe('The text to replace'),
  newString: z.string().describe('The replacement text'),
})

const FileEditOutput = z.object({
  path: z.string(),
  replacements: z.number(),
})

export const FileEditTool = buildTool({
  name: 'file_edit',
  description: 'Edit a file by replacing text. Replaces ALL occurrences of oldString with newString.',
  
  inputSchema: FileEditInput,
  outputSchema: FileEditOutput,
  
  aliases: ['edit', 'replace'],
  searchHint: 'edit file replace text',
  
  isConcurrencySafe: () => false,  // 编辑不能并行
  isReadOnly: () => false,
  
  userFacingName: (input) => input?.path ? `Editing ${input.path}` : 'file_edit',
  toAutoClassifierInput: (input) => `Edit ${input.path}`,
  
  checkPermissions: async (input, context) => {
    const fullPath = resolvePath(input.path, context.workspacePath)
    
    if (!fullPath.startsWith(context.workspacePath)) {
      return {
        type: 'deny',
        message: `Cannot edit files outside workspace: ${input.path}`
      }
    }
    
    return {
      type: 'ask',
      prompt: `Edit file: ${input.path}?`
    }
  },
  
  execute: async (input, context) => {
    const fullPath = resolvePath(input.path, context.workspacePath)
    
    context.sendLog(`Editing file: ${input.path}`)
    
    const result = await editFile(fullPath, input.oldString, input.newString)
    
    return {
      path: fullPath,
      replacements: result.replacements
    }
  },
  
  renderToolUseMessage: (input) => `🔧 Editing: ${input.path}`,
  renderToolResultMessage: (result) => `✓ Made ${result.replacements} replacement(s)`
})
