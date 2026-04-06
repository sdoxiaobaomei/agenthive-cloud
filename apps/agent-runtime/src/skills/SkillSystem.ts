// Skill System - 技能命令系统，参考 Claude Code 的 SkillTool
import { z } from 'zod'
import { EventEmitter } from 'events'
import { LLMService } from '../services/llm/LLMService.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import { Logger } from '../utils/logger.js'

export interface SkillCommand {
  name: string
  description: string
  aliases?: string[]
  type: 'prompt' | 'function'
  // For prompt type
  prompt?: string | ((args: string, context: SkillContext) => Promise<string>)
  // For function type
  execute?: (args: string, context: SkillContext) => Promise<string>
  // Agent configuration for forked execution
  agentType?: string
  allowedTools?: string[]
}

export interface SkillContext {
  agentId: string
  workspacePath: string
  llmService: LLMService
  sendLog: (message: string, isError?: boolean) => void
}

export interface Skill {
  name: string
  description: string
  commands: SkillCommand[]
}

export class SkillSystem extends EventEmitter {
  private skills: Map<string, Skill> = new Map()
  private commands: Map<string, SkillCommand> = new Map()
  private aliases: Map<string, string> = new Map()
  private logger: Logger

  constructor() {
    super()
    this.logger = new Logger('SkillSystem')
  }

  // 注册技能
  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill)

    // 注册命令
    for (const command of skill.commands) {
      this.commands.set(command.name, command)

      // 注册别名
      if (command.aliases) {
        for (const alias of command.aliases) {
          this.aliases.set(alias, command.name)
        }
      }
    }

    this.logger.info(`Registered skill: ${skill.name} with ${skill.commands.length} commands`)
    this.emit('skill:registered', { name: skill.name })
  }

  // 获取命令
  getCommand(name: string): SkillCommand | undefined {
    // 检查别名
    const aliasedName = this.aliases.get(name)
    if (aliasedName) {
      return this.commands.get(aliasedName)
    }

    return this.commands.get(name)
  }

  // 列出所有命令
  listCommands(): Array<{ name: string; description: string; skill: string }> {
    const result: Array<{ name: string; description: string; skill: string }> = []

    for (const [skillName, skill] of this.skills) {
      for (const command of skill.commands) {
        result.push({
          name: command.name,
          description: command.description,
          skill: skillName
        })
      }
    }

    return result
  }

  // 执行命令
  async execute(
    commandName: string,
    args: string,
    context: SkillContext
  ): Promise<{ success: boolean; output: string }> {
    const command = this.getCommand(commandName)

    if (!command) {
      const error = `Unknown command: ${commandName}. Available: ${this.listCommands().map(c => c.name).join(', ')}`
      return { success: false, output: error }
    }

    this.logger.info(`Executing command: ${commandName}`, { args })
    this.emit('command:start', { name: commandName, args })

    try {
      let output: string

      if (command.type === 'prompt' && command.prompt) {
        // Prompt 类型：构建提示词并调用 LLM
        const prompt = typeof command.prompt === 'function'
          ? await command.prompt(args, context)
          : command.prompt + '\n\n' + args

        const result = await context.llmService.complete([
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ])

        output = result.content

      } else if (command.type === 'function' && command.execute) {
        // Function 类型：直接执行
        output = await command.execute(args, context)

      } else {
        throw new Error(`Invalid command configuration: ${commandName}`)
      }

      this.logger.info(`Command completed: ${commandName}`)
      this.emit('command:complete', { name: commandName, output })

      return { success: true, output }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Command failed: ${commandName}`, { error: message })
      this.emit('command:error', { name: commandName, error: message })

      return { success: false, output: message }
    }
  }

  // 解析命令字符串
  parseCommand(input: string): { command: string; args: string } | null {
    const match = input.match(/^\/([a-zA-Z_]+)\s*(.*)$/)
    if (!match) return null

    return {
      command: match[1],
      args: match[2].trim()
    }
  }
}

// 内置技能
export const BuiltInSkills: Skill[] = [
  {
    name: 'system',
    description: 'System commands',
    commands: [
      {
        name: 'help',
        description: 'Show help information',
        aliases: ['h', '?'],
        type: 'prompt',
        prompt: async (args, context) => {
          return `Provide help information for: ${args || 'all commands'}`
        }
      },
      {
        name: 'commit',
        description: 'Generate a commit message for staged changes',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Generate a conventional commit message for the following changes:\n${args}`
        }
      },
      {
        name: 'explain',
        description: 'Explain code or concepts',
        aliases: ['exp'],
        type: 'prompt',
        prompt: async (args, context) => {
          return `Explain the following in detail:\n${args}`
        }
      },
      {
        name: 'review',
        description: 'Review code for issues',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Review the following code for bugs, style issues, and improvements:\n${args}`
        }
      },
      {
        name: 'refactor',
        description: 'Suggest refactoring improvements',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Suggest refactoring improvements for:\n${args}`
        }
      },
      {
        name: 'test',
        description: 'Generate tests for code',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Generate comprehensive tests for:\n${args}`
        }
      },
      {
        name: 'doc',
        description: 'Generate documentation',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Generate documentation for:\n${args}`
        }
      }
    ]
  },
  {
    name: 'code',
    description: 'Code manipulation commands',
    commands: [
      {
        name: 'fix',
        description: 'Fix code issues',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Fix any issues in the following code:\n${args}`
        }
      },
      {
        name: 'optimize',
        description: 'Optimize code performance',
        aliases: ['opt'],
        type: 'prompt',
        prompt: async (args, context) => {
          return `Optimize the following code for better performance:\n${args}`
        }
      },
      {
        name: 'type',
        description: 'Add TypeScript types',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Add proper TypeScript types to:\n${args}`
        }
      },
      {
        name: 'lint',
        description: 'Check and fix linting issues',
        type: 'prompt',
        prompt: async (args, context) => {
          return `Check and fix linting issues in:\n${args}`
        }
      }
    ]
  }
]

// 初始化技能系统
export function initializeSkillSystem(): SkillSystem {
  const system = new SkillSystem()

  // 注册内置技能
  for (const skill of BuiltInSkills) {
    system.registerSkill(skill)
  }

  return system
}
