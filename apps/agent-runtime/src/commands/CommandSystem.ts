/**
 * Command System - Slash Commands inspired by Claude Code
 * 
 * 核心特性：
 * 1. Prompt Commands - 生成提示词发送给 AI
 * 2. Local Commands - 本地直接执行
 * 3. 动态命令加载（技能、插件）
 * 4. 命令权限控制
 */
import { z } from 'zod'
import { EventEmitter } from 'events'
import { Logger } from '../utils/logger.js'

// ============================================================================
// 命令类型定义
// ============================================================================

export type CommandSource = 'builtin' | 'plugin' | 'skill' | 'bundled' | 'mcp'
export type CommandContextType = 'inline' | 'fork'

export interface CommandExecutionContext {
  agentId: string
  workspacePath: string
  sendLog: (message: string, isError?: boolean) => void
  llm?: {
    complete: (prompt: string, options?: any) => Promise<string>
    chat: (messages: any[], options?: any) => Promise<string>
  }
  // 当前对话上下文
  conversation?: {
    getMessages: () => Array<{ role: string; content: string }>
    addMessage: (message: { role: string; content: string }) => void
  }
}

// Prompt Command - 生成提示词发送给 AI
export interface PromptCommand {
  type: 'prompt'
  name: string
  description: string
  // 命令别名
  aliases?: string[]
  // 执行时的进度消息
  progressMessage: string
  // 参数名列表
  argNames?: string[]
  // 允许的工具（权限控制）
  allowedTools?: string[]
  // 专用模型
  model?: string
  // 命令来源
  source: CommandSource
  // 执行上下文
  context?: CommandContextType
  // 使用的 Agent 类型（fork 时）
  agent?: string
  // 努力程度（影响迭代次数等）
  effort?: 'low' | 'medium' | 'high'
  // 文件路径匹配（用于特定路径命令）
  paths?: string[]
  // 生成提示词
  getPromptForCommand: (args: string, context: CommandExecutionContext) => Promise<Array<{
    role: 'user' | 'system' | 'assistant'
    content: string
  }>>
}

// Local Command - 本地直接执行
export interface LocalCommand {
  type: 'local'
  name: string
  description: string
  aliases?: string[]
  // 是否支持非交互模式
  supportsNonInteractive: boolean
  source: CommandSource
  // 执行命令
  execute: (args: string, context: CommandExecutionContext) => Promise<{
    success: boolean
    output?: string
    error?: string
    // 是否继续 AI 处理
    continueToAI?: boolean
    // 要添加到对话的消息
    messages?: Array<{
      role: 'user' | 'system' | 'assistant'
      content: string
    }>
  }>
}

// Local JSX Command - 本地渲染 UI（简化版，不依赖 React）
export interface LocalJSXCommand {
  type: 'local-jsx'
  name: string
  description: string
  aliases?: string[]
  source: CommandSource
  // 渲染组件（返回文本描述）
  render: (args: string, context: CommandExecutionContext) => Promise<{
    output: string
    interactive?: boolean
  }>
}

export type Command = PromptCommand | LocalCommand | LocalJSXCommand

// ============================================================================
// 内置命令定义
// ============================================================================

const builtinCommands: Command[] = [
  // /clear - 清除对话
  {
    type: 'local',
    name: 'clear',
    description: 'Clear the conversation history',
    aliases: ['cls'],
    supportsNonInteractive: true,
    source: 'builtin',
    async execute(args, context) {
      context.conversation?.addMessage({
        role: 'system',
        content: '[Conversation cleared]'
      })
      return {
        success: true,
        output: 'Conversation history cleared.',
        continueToAI: false
      }
    }
  },

  // /compact - 压缩上下文
  {
    type: 'prompt',
    name: 'compact',
    description: 'Compact the conversation context to save tokens',
    progressMessage: 'Compacting conversation...',
    source: 'builtin',
    effort: 'low',
    async getPromptForCommand(args, context) {
      const messages = context.conversation?.getMessages() || []
      const summary = messages.length > 10 
        ? `Previous conversation with ${messages.length} messages has been compacted.`
        : 'Conversation is still short, no compaction needed yet.'
      
      return [{
        role: 'system',
        content: `[Context Compaction] ${summary}\n\nKey points from previous conversation:\n- Previous context was summarized to save tokens\n- Continue with the current task`
      }]
    }
  },

  // /commit - Git 提交
  {
    type: 'prompt',
    name: 'commit',
    description: 'Generate a commit message for current changes',
    progressMessage: 'Analyzing changes...',
    source: 'builtin',
    allowedTools: ['bash', 'file_read'],
    effort: 'medium',
    async getPromptForCommand(args, context) {
      return [{
        role: 'user',
        content: `Please analyze the current git changes and create a commit message.

Steps:
1. Run 'git status' to see changed files
2. Run 'git diff --stat' to see summary of changes
3. Run 'git diff' to see actual changes
4. Create a concise, descriptive commit message following conventional commits format

${args ? `Additional context: ${args}` : ''}`
      }]
    }
  },

  // /review - 代码审查
  {
    type: 'prompt',
    name: 'review',
    description: 'Review code for issues and improvements',
    aliases: ['code-review'],
    progressMessage: 'Reviewing code...',
    source: 'builtin',
    allowedTools: ['file_read', 'glob', 'grep'],
    effort: 'high',
    async getPromptForCommand(args, context) {
      const target = args || 'the current changes'
      return [{
        role: 'user',
        content: `Please review ${target} for:

1. Code quality issues
2. Potential bugs
3. Performance concerns
4. Security issues
5. Style inconsistencies
6. Missing error handling

Provide specific, actionable feedback with line references where possible.`
      }]
    }
  },

  // /explain - 解释代码
  {
    type: 'prompt',
    name: 'explain',
    description: 'Explain the selected code or file',
    progressMessage: 'Analyzing code...',
    source: 'builtin',
    allowedTools: ['file_read', 'grep'],
    effort: 'medium',
    async getPromptForCommand(args, context) {
      return [{
        role: 'user',
        content: `Please explain the following code:\n\n${args || 'Please read the relevant files and explain what they do.'}`
      }]
    }
  },

  // /test - 生成测试
  {
    type: 'prompt',
    name: 'test',
    description: 'Generate tests for the current code',
    progressMessage: 'Analyzing code structure...',
    source: 'builtin',
    allowedTools: ['file_read', 'glob', 'file_write'],
    effort: 'high',
    async getPromptForCommand(args, context) {
      return [{
        role: 'user',
        content: `Please generate comprehensive tests for: ${args || 'the current codebase'}

Requirements:
1. Cover main functionality
2. Include edge cases
3. Test error conditions
4. Use appropriate testing framework
5. Follow testing best practices`
      }]
    }
  },

  // /fix - 修复问题
  {
    type: 'prompt',
    name: 'fix',
    description: 'Fix issues in the code',
    progressMessage: 'Analyzing issues...',
    source: 'builtin',
    effort: 'high',
    async getPromptForCommand(args, context) {
      return [{
        role: 'user',
        content: `Please fix the following issue(s): ${args || 'any issues you find in the codebase'}

Steps:
1. Identify the root cause
2. Implement a minimal fix
3. Verify the fix doesn't break anything
4. Explain what was changed and why`
      }]
    }
  },

  // /refactor - 重构代码
  {
    type: 'prompt',
    name: 'refactor',
    description: 'Refactor code for better structure',
    progressMessage: 'Analyzing code structure...',
    source: 'builtin',
    allowedTools: ['file_read', 'file_edit', 'file_write'],
    effort: 'high',
    async getPromptForCommand(args, context) {
      return [{
        role: 'user',
        content: `Please refactor the following code: ${args || 'identify areas for improvement in the codebase'}

Focus on:
1. Improving readability
2. Reducing complexity
3. Improving maintainability
4. Following best practices

Make minimal, focused changes while preserving functionality.`
      }]
    }
  },

  // /doc - 生成文档
  {
    type: 'prompt',
    name: 'doc',
    description: 'Generate documentation for code',
    progressMessage: 'Analyzing code...',
    source: 'builtin',
    allowedTools: ['file_read', 'file_write'],
    effort: 'medium',
    async getPromptForCommand(args, context) {
      return [{
        role: 'user',
        content: `Please generate documentation for: ${args || 'the current codebase'}

Include:
1. API documentation
2. Usage examples
3. Important concepts explanation
4. Setup instructions if applicable`
      }]
    }
  },

  // /help - 显示帮助
  {
    type: 'local',
    name: 'help',
    description: 'Show available commands and their usage',
    aliases: ['?', 'h'],
    supportsNonInteractive: true,
    source: 'builtin',
    async execute(args, context) {
      return {
        success: true,
        output: `Available Commands:

/clear, /cls         - Clear conversation history
/compact             - Compact context to save tokens
/commit [msg]        - Generate commit message
/review [target]     - Review code for issues
/explain [code]      - Explain code
/test [target]       - Generate tests
/fix [issue]         - Fix code issues
/refactor [target]   - Refactor code
/doc [target]        - Generate documentation
/help                - Show this help message

Use "/<command> --help" for more details on a specific command.`,
        continueToAI: false
      }
    }
  }
]

// ============================================================================
// 命令注册表
// ============================================================================

export class CommandRegistry extends EventEmitter {
  private commands = new Map<string, Command>()
  private aliasMap = new Map<string, string>()
  private logger = new Logger('CommandRegistry')

  constructor() {
    super()
    // 注册内置命令
    for (const cmd of builtinCommands) {
      this.register(cmd)
    }
  }

  register(command: Command): void {
    this.commands.set(command.name, command)
    
    // 注册别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliasMap.set(alias, command.name)
      }
    }
    
    this.logger.debug(`Registered command: ${command.name}`)
    this.emit('command:registered', { name: command.name, type: command.type })
  }

  get(name: string): Command | undefined {
    // 去除前导斜杠
    const cleanName = name.startsWith('/') ? name.slice(1) : name
    
    // 先查找主名
    const cmd = this.commands.get(cleanName)
    if (cmd) return cmd
    
    // 再查找别名
    const aliasedName = this.aliasMap.get(cleanName)
    if (aliasedName) {
      return this.commands.get(aliasedName)
    }
    
    return undefined
  }

  has(name: string): boolean {
    const cleanName = name.startsWith('/') ? name.slice(1) : name
    return this.commands.has(cleanName) || this.aliasMap.has(cleanName)
  }

  list(): Command[] {
    return Array.from(this.commands.values())
  }

  listByType(type: Command['type']): Command[] {
    return this.list().filter(cmd => cmd.type === type)
  }

  listBySource(source: CommandSource): Command[] {
    return this.list().filter(cmd => cmd.source === source)
  }

  // 查找命令（支持模糊匹配）
  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase()
    return this.list().filter(cmd => {
      if (cmd.name.toLowerCase().includes(lowerQuery)) return true
      if (cmd.description.toLowerCase().includes(lowerQuery)) return true
      if (cmd.aliases?.some(a => a.toLowerCase().includes(lowerQuery))) return true
      return false
    })
  }

  unregister(name: string): boolean {
    const cmd = this.commands.get(name)
    if (!cmd) return false

    this.commands.delete(name)
    
    // 清理别名
    for (const [alias, target] of this.aliasMap.entries()) {
      if (target === name) {
        this.aliasMap.delete(alias)
      }
    }
    
    this.emit('command:unregistered', { name })
    return true
  }

  clear(): void {
    this.commands.clear()
    this.aliasMap.clear()
    this.emit('commands:cleared')
  }
}

// ============================================================================
// 命令执行器
// ============================================================================

export class CommandExecutor extends EventEmitter {
  private registry: CommandRegistry
  private logger = new Logger('CommandExecutor')

  constructor(registry: CommandRegistry) {
    super()
    this.registry = registry
  }

  // 解析命令输入
  parse(input: string): { command: string; args: string } | null {
    if (!input.startsWith('/')) {
      return null
    }

    const parts = input.slice(1).split(/\s+(.+)/)
    const command = parts[0]
    const args = parts[1] || ''

    return { command, args }
  }

  // 执行命令
  async execute(
    input: string,
    context: CommandExecutionContext
  ): Promise<{
    handled: boolean
    type?: Command['type']
    result?: any
    messages?: Array<{ role: string; content: string }>
  }> {
    const parsed = this.parse(input)
    if (!parsed) {
      return { handled: false }
    }

    const cmd = this.registry.get(parsed.command)
    if (!cmd) {
      context.sendLog(`Unknown command: ${parsed.command}`, true)
      return { handled: false }
    }

    this.logger.info(`Executing command: ${cmd.name}`)
    this.emit('command:executing', { name: cmd.name, args: parsed.args })

    try {
      switch (cmd.type) {
        case 'prompt': {
          const messages = await cmd.getPromptForCommand(parsed.args, context)
          this.emit('command:executed', { name: cmd.name, success: true })
          return {
            handled: true,
            type: 'prompt',
            messages
          }
        }

        case 'local': {
          const result = await cmd.execute(parsed.args, context)
          this.emit('command:executed', { name: cmd.name, success: result.success })
          return {
            handled: true,
            type: 'local',
            result,
            messages: result.messages
          }
        }

        case 'local-jsx': {
          const renderResult = await cmd.render(parsed.args, context)
          this.emit('command:executed', { name: cmd.name, success: true })
          return {
            handled: true,
            type: 'local-jsx',
            result: renderResult
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Command execution failed: ${cmd.name}`, { error: message })
      this.emit('command:failed', { name: cmd.name, error: message })
      
      return {
        handled: true,
        type: cmd.type,
        result: { success: false, error: message }
      }
    }
  }

  // 检查是否是命令
  isCommand(input: string): boolean {
    return input.startsWith('/')
  }

  // 获取命令补全建议
  getCompletions(partial: string): Array<{ name: string; description: string }> {
    if (!partial.startsWith('/')) {
      return []
    }

    const query = partial.slice(1)
    const commands = this.registry.search(query)
    
    return commands.map(cmd => ({
      name: `/${cmd.name}`,
      description: cmd.description
    }))
  }
}

// ============================================================================
// 全局实例
// ============================================================================

export function createCommandSystem(): { registry: CommandRegistry; executor: CommandExecutor } {
  const registry = new CommandRegistry()
  const executor = new CommandExecutor(registry)
  return { registry, executor }
}
