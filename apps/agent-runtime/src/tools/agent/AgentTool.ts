// Agent Tool - 创建并运行子代理
import { z } from 'zod'
import { buildTool, ToolContext } from '../Tool.js'
import { SubAgentManager } from '../../agent/SubAgent.js'
import { ConversationContextV2 } from '../../context/ConversationContextV2.js'

const AgentToolInput = z.object({
  agentType: z.enum(['coder', 'explorer', 'planner', 'reviewer']).describe('The type of sub-agent to create'),
  directive: z.string().describe('The task directive for the sub-agent'),
  context: z.record(z.any()).optional().describe('Additional context for the sub-agent'),
  async: z.boolean().optional().default(false).describe('Run asynchronously (return immediately)')
})

const AgentToolOutput = z.object({
  success: z.boolean(),
  agentType: z.string(),
  content: z.string(),
  toolCalls: z.array(z.object({
    name: z.string(),
    input: z.any(),
    output: z.any()
  })),
  iterations: z.number(),
  duration: z.number()
})

export type AgentToolInput = z.infer<typeof AgentToolInput>
export type AgentToolOutput = z.infer<typeof AgentToolOutput>

// 内置代理定义
const BUILT_IN_AGENTS: Record<string, {
  name: string
  description: string
  systemPrompt: string
  tools: string[]
  maxTurns: number
  temperature: number
}> = {
  coder: {
    name: 'Code Specialist',
    description: 'Specialized in writing, editing, and reviewing code',
    systemPrompt: `You are a code specialist. Your task is to write, edit, and review code.
Follow these guidelines:
- Write clean, well-documented code
- Follow best practices and conventions
- Add appropriate error handling
- Consider edge cases
- Prefer simple solutions over complex ones

Available tools: file_read, file_write, file_edit, grep, bash`,
    tools: ['file_read', 'file_write', 'file_edit', 'grep', 'bash', 'git'],
    maxTurns: 15,
    temperature: 0.3
  },
  explorer: {
    name: 'Code Explorer',
    description: 'Specialized in exploring and understanding codebases',
    systemPrompt: `You are a code explorer. Your task is to understand and analyze codebases.
Follow these guidelines:
- Start by exploring the project structure
- Read relevant files to understand the code
- Use grep to find patterns and references
- Provide clear summaries of your findings
- Ask questions if you need clarification

Available tools: file_read, glob, grep, bash`,
    tools: ['file_read', 'glob', 'grep', 'bash'],
    maxTurns: 20,
    temperature: 0.5
  },
  planner: {
    name: 'Task Planner',
    description: 'Specialized in planning and breaking down tasks',
    systemPrompt: `You are a task planner. Your task is to break down complex tasks into manageable steps.
Follow these guidelines:
- Analyze the requirements carefully
- Break down into logical steps
- Identify dependencies between steps
- Estimate complexity
- Suggest the best order of execution

Available tools: file_read, glob`,
    tools: ['file_read', 'glob'],
    maxTurns: 10,
    temperature: 0.4
  },
  reviewer: {
    name: 'Code Reviewer',
    description: 'Specialized in reviewing code and providing feedback',
    systemPrompt: `You are a code reviewer. Your task is to review code and provide constructive feedback.
Follow these guidelines:
- Check for bugs and potential issues
- Verify code style and conventions
- Look for security vulnerabilities
- Suggest improvements
- Be constructive and specific in your feedback

Available tools: file_read, grep`,
    tools: ['file_read', 'grep', 'git'],
    maxTurns: 15,
    temperature: 0.3
  }
}

// Agent Tool 工厂函数
export function createAgentTool(
  subAgentManager: SubAgentManager,
  parentContext?: ConversationContextV2
) {
  return buildTool({
    name: 'agent',
    description: `Create and run a specialized sub-agent to handle specific tasks.
Available agent types:
- coder: Write, edit, and review code
- explorer: Explore and understand codebases  
- planner: Plan and break down complex tasks
- reviewer: Review code and provide feedback`,
    inputSchema: AgentToolInput,
    outputSchema: AgentToolOutput,

    async execute(input, context) {
      const agentDef = BUILT_IN_AGENTS[input.agentType]

      context.sendLog(`Creating ${input.agentType} agent: ${agentDef.name}`)
      context.sendLog(`Directive: ${input.directive.slice(0, 100)}...`)

      try {
        const result = await subAgentManager.execute(input.agentType, input.directive, {
          context: input.context,
          forkContext: !input.async,
          parentContext,
          isAsync: input.async
        })

        context.sendLog(`✓ Agent ${input.agentType} completed in ${result.duration}ms`)

        return {
          success: result.success,
          agentType: result.agentType,
          content: result.content,
          toolCalls: result.toolCalls,
          iterations: result.iterations,
          duration: result.duration
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.sendLog(`Agent failed: ${message}`, true)

        return {
          success: false,
          agentType: input.agentType,
          content: '',
          toolCalls: [],
          iterations: 0,
          duration: 0
        }
      }
    },

    renderToolUseMessage(input) {
      return `🤖 Starting ${input.agentType} agent: ${input.directive.slice(0, 60)}...`
    },

    renderToolResultMessage(result: AgentToolOutput): string {
      return `✓ Agent completed: ${result.iterations} iterations, ${result.duration}ms`
    }
  })
}

// 初始化子代理管理器时注册内置代理
export function registerBuiltInAgents(subAgentManager: SubAgentManager): void {
  for (const [agentType, def] of Object.entries(BUILT_IN_AGENTS)) {
    subAgentManager.registerAgent({
      agentType,
      name: def.name,
      description: def.description,
      systemPrompt: def.systemPrompt,
      tools: def.tools,
      maxTurns: def.maxTurns,
      temperature: def.temperature
    })
  }
}
