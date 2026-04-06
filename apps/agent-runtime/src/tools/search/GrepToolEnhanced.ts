/**
 * Enhanced Grep Tool - 优化的代码搜索工具
 * 
 * 参考 Claude Code 设计优化：
 * 1. 并发安全（纯搜索操作）
 * 2. 丰富的搜索选项
 * 3. 结果限制和格式化
 * 4. 搜索提示支持
 */

import { z } from 'zod'
import { buildTool } from '../ToolEnhanced.js'
import { spawn } from 'child_process'
import { resolvePath } from '../../utils/path.js'

// ============================================================================
// Schema 定义
// ============================================================================

const GrepInput = z.object({
  pattern: z.string().describe('Search pattern (regex supported)'),
  path: z.string().optional().default('.').describe('Directory or file to search in'),
  include: z.string().optional().describe('File pattern to include (e.g., "*.ts")'),
  exclude: z.string().optional().describe('File pattern to exclude (e.g., "*.test.ts")'),
  caseSensitive: z.boolean().optional().default(false).describe('Case sensitive search'),
  wholeWord: z.boolean().optional().default(false).describe('Match whole words only'),
  maxResults: z.number().optional().default(100).describe('Maximum number of results'),
}).describe('Search for patterns in files using ripgrep')

const GrepMatch = z.object({
  path: z.string().describe('File path'),
  line: z.number().describe('Line number (1-indexed)'),
  column: z.number().optional().describe('Column number'),
  content: z.string().describe('Matching line content'),
  match: z.string().describe('The matched text'),
})

const GrepOutput = z.object({
  matches: z.array(GrepMatch).describe('Search results'),
  totalMatches: z.number().describe('Total number of matches found'),
  filesSearched: z.number().describe('Number of files searched'),
  truncated: z.boolean().describe('Whether results were truncated due to limit'),
  duration: z.number().describe('Search duration in milliseconds'),
})

export type GrepInput = z.infer<typeof GrepInput>
export type GrepOutput = z.infer<typeof GrepOutput>

// ============================================================================
// Grep 工具
// ============================================================================

export const GrepTool = buildTool({
  name: 'grep',
  description: `Search for patterns in code files using ripgrep.

Features:
- Supports regular expressions
- Fast parallel search
- Configurable file filters
- Results include file path, line number, and context

Examples:
- Find function definitions: { "pattern": "function\\s+\\w+", "path": "src/" }
- Search for TODOs: { "pattern": "TODO|FIXME", "include": "*.ts" }
- Find imports: { "pattern": "import.*from", "include": "*.tsx" }`,
  
  inputSchema: GrepInput,
  outputSchema: GrepOutput,
  
  aliases: ['search', 'find', 'rg'],
  searchHint: 'search code grep find pattern',
  
  // 搜索是并发安全的只读操作
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  
  userFacingName: (input) => {
    if (input?.pattern) {
      return `Searching "${input.pattern.slice(0, 30)}${input.pattern.length > 30 ? '...' : ''}"`
    }
    return 'grep'
  },
  
  toAutoClassifierInput: (input) => `Grep "${input.pattern}" in ${input.path || '.'}`,
  
  checkPermissions: async (input, context) => {
    const searchPath = resolvePath(input.path || '.', context.workspacePath)
    
    // 检查是否在 workspace 内
    if (!searchPath.startsWith(context.workspacePath)) {
      return {
        type: 'deny',
        message: 'Cannot search outside workspace'
      }
    }
    
    return { type: 'allow' }
  },
  
  execute: async (input, context): Promise<GrepOutput> => {
    const startTime = Date.now()
    const searchPath = resolvePath(input.path || '.', context.workspacePath)
    
    context.sendLog(`Searching: "${input.pattern}" in ${input.path || '.'}`)
    
    // 构建 ripgrep 参数
    const args: string[] = [
      '--json',           // JSON 输出
      '--line-number',    // 显示行号
      '--column',         // 显示列号
      '-C', '2',          // 2 行上下文
    ]
    
    // 大小写敏感
    if (!input.caseSensitive) {
      args.push('-i')
    }
    
    // 整词匹配
    if (input.wholeWord) {
      args.push('-w')
    }
    
    // 包含模式
    if (input.include) {
      args.push('-g', input.include)
    }
    
    // 排除模式
    if (input.exclude) {
      args.push('-g', `!${input.exclude}`)
    }
    
    // 排除常见非代码目录
    args.push('-g', '!node_modules')
    args.push('-g', '!.git')
    args.push('-g', '!dist')
    args.push('-g', '!build')
    
    // 搜索模式
    args.push(input.pattern)
    
    // 搜索路径
    args.push(searchPath)
    
    return new Promise((resolve, reject) => {
      const rg = spawn('rg', args, { cwd: context.workspacePath })
      
      let stdout = ''
      let stderr = ''
      
      rg.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      rg.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      rg.on('error', (error) => {
        // 如果 ripgrep 不可用，使用 Node.js 实现回退
        if ((error as any).code === 'ENOENT') {
          fallbackGrep(input, context, searchPath)
            .then(resolve)
            .catch(reject)
          return
        }
        reject(error)
      })
      
      rg.on('close', (code) => {
        const duration = Date.now() - startTime
        
        // 解析 JSON 输出
        const lines = stdout.trim().split('\n').filter(Boolean)
        const matches: z.infer<typeof GrepMatch>[] = []
        let filesSearched = new Set<string>()
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.type === 'match') {
              const match = data.data
              filesSearched.add(match.path.text)
              
              // 提取匹配文本
              const matchedText = match.submatches?.[0]?.match?.text || ''
              
              // 构建内容（包含上下文）
              let content = ''
              if (match.lines?.before) {
                content += match.lines.before.map((l: any) => l.text).join('\n') + '\n'
              }
              content += match.lines?.text || ''
              if (match.lines?.after) {
                content += '\n' + match.lines.after.map((l: any) => l.text).join('\n')
              }
              
              matches.push({
                path: match.path.text,
                line: match.line_number,
                column: match.submatches?.[0]?.start,
                content: content.trim(),
                match: matchedText
              })
              
              // 限制结果数量
              if (matches.length >= input.maxResults) {
                rg.kill()
                break
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
        
        resolve({
          matches,
          totalMatches: matches.length,
          filesSearched: filesSearched.size,
          truncated: matches.length >= input.maxResults,
          duration
        })
      })
    })
  },
  
  renderToolUseMessage: (input) => `🔍 Grep: "${input.pattern}" in ${input.path || '.'}`,
  
  renderToolResultMessage: (result) => {
    if (result.totalMatches === 0) {
      return '✓ No matches found'
    }
    const truncated = result.truncated ? ' (truncated)' : ''
    return `✓ Found ${result.totalMatches} matches in ${result.filesSearched} files${truncated}, ${result.duration}ms`
  }
})

// ============================================================================
// Node.js 回退实现（当 ripgrep 不可用时）
// ============================================================================

import { promises as fs } from 'fs'
import { join } from 'path'

async function fallbackGrep(
  input: GrepInput,
  context: ToolContext,
  searchPath: string
): Promise<GrepOutput> {
  const startTime = Date.now()
  const matches: z.infer<typeof GrepMatch>[] = []
  const filesSearched = new Set<string>()
  
  const pattern = input.caseSensitive 
    ? new RegExp(input.pattern) 
    : new RegExp(input.pattern, 'i')
  
  async function searchDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      
      // 跳过排除的目录
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          continue
        }
        await searchDir(fullPath)
        continue
      }
      
      // 检查文件过滤
      if (input.include && !entry.name.match(input.include.replace('*', '.*'))) {
        continue
      }
      if (input.exclude && entry.name.match(input.exclude.replace('*', '.*'))) {
        continue
      }
      
      filesSearched.add(fullPath)
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8')
        const lines = content.split('\n')
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const matchResult = line.match(pattern)
          
          if (matchResult) {
            // 检查整词匹配
            if (input.wholeWord) {
              const wordRegex = new RegExp(
                `\\b${input.pattern}\\b`,
                input.caseSensitive ? '' : 'i'
              )
              if (!wordRegex.test(line)) continue
            }
            
            matches.push({
              path: fullPath,
              line: i + 1,
              column: matchResult.index || 0,
              content: line.trim(),
              match: matchResult[0]
            })
            
            if (matches.length >= input.maxResults) {
              return
            }
          }
        }
      } catch {
        // 忽略无法读取的文件
      }
    }
  }
  
  // 检查是文件还是目录
  const stat = await fs.stat(searchPath)
  if (stat.isDirectory()) {
    await searchDir(searchPath)
  } else {
    filesSearched.add(searchPath)
    const content = await fs.readFile(searchPath, 'utf-8')
    const lines = content.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const matchResult = line.match(pattern)
      
      if (matchResult) {
        matches.push({
          path: searchPath,
          line: i + 1,
          column: matchResult.index || 0,
          content: line.trim(),
          match: matchResult[0]
        })
        
        if (matches.length >= input.maxResults) break
      }
    }
  }
  
  return {
    matches,
    totalMatches: matches.length,
    filesSearched: filesSearched.size,
    truncated: matches.length >= input.maxResults,
    duration: Date.now() - startTime
  }
}
