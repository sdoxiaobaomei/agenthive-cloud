/**
 * Agent Runtime - Agent 使用示例
 */

import { 
  initialize,
  initializeAgentManager,
  createStandardToolRegistry,
  getAgentManager,
  BUILTIN_AGENTS,
  Logger
} from '../src/index.js'

async function main() {
  const logger = new Logger('Example')
  
  // 1. 初始化
  console.log('=== Initializing ===')
  const { toolRegistry } = await initialize({
    logLevel: 'info',
    permissionMode: 'allow' // Allow mode for demo
  })

  // 2. 创建 LLM 服务模拟（实际项目中使用真实 LLM 服务）
  const mockLLMService = {
    async complete(messages: any[], options: any) {
      // 模拟 LLM 响应
      const lastMessage = messages[messages.length - 1]
      
      // 简单的模拟逻辑
      if (lastMessage.content.includes('list')) {
        return {
          content: 'I will list the files for you.',
          toolCalls: [{
            id: 'call-1',
            function: {
              name: 'bash',
              arguments: JSON.stringify({ command: 'ls -la', description: 'List all files' })
            }
          }]
        }
      }
      
      return {
        content: 'Task completed.',
        toolCalls: []
      }
    }
  }

  // 3. 初始化 AgentManager
  console.log('\n=== Initializing AgentManager ===')
  const agentManager = initializeAgentManager(toolRegistry, mockLLMService)

  // 4. 监听 Agent 事件
  agentManager.on('task:created', ({ id, agentType }) => {
    console.log(`[Event] Agent created: ${id} (${agentType})`)
  })

  agentManager.on('task:started', ({ id }) => {
    console.log(`[Event] Agent started: ${id}`)
  })

  agentManager.on('task:completed', ({ id, success, duration }) => {
    console.log(`[Event] Agent completed: ${id} (success=${success}, ${duration}ms)`)
  })

  agentManager.on('task:progress', ({ id, progress }) => {
    console.log(`[Event] Agent progress: ${id} - ${progress.type}`)
  })

  // 5. 创建并运行 Explore Agent
  console.log('\n=== Creating Explore Agent ===')
  console.log('Built-in agents:', Object.keys(BUILTIN_AGENTS))

  const exploreTask = agentManager.createTask({
    description: 'Explore project structure',
    prompt: 'Explore the current project structure and list all TypeScript files.',
    subagentType: 'explore',
    maxIterations: 5
  })

  console.log(`Created agent: ${exploreTask.id}`)

  // 6. 运行 Agent（使用模拟 LLM，实际执行会失败）
  console.log('\n=== Running Agent (Mock) ===')
  try {
    // 注意：由于使用 mock LLM，实际工具执行不会工作
    // 在实际项目中，使用真实的 LLMService
    const result = await agentManager.run(exploreTask.id)
    console.log('Agent result:', {
      success: result.success,
      iterations: result.iterations,
      content: result.content.slice(0, 100) + '...'
    })
  } catch (error) {
    console.log('Expected error with mock LLM:', (error as Error).message)
  }

  // 7. 创建团队
  console.log('\n=== Creating Team ===')
  agentManager.createTeam('demo-team')

  // 8. 生成队友（后台运行）
  console.log('\n=== Spawning Teammates ===')
  const teammate1 = agentManager.spawnTeammate(
    'demo-team',
    {
      description: 'Find config files',
      prompt: 'Find all configuration files in the project.',
      subagentType: 'explore',
      name: 'config-finder'
    }
  )

  const teammate2 = agentManager.spawnTeammate(
    'demo-team',
    {
      description: 'Check dependencies',
      prompt: 'Analyze package.json dependencies.',
      subagentType: 'explore',
      name: 'dependency-analyzer'
    }
  )

  console.log(`Spawned teammates: ${teammate1.id}, ${teammate2.id}`)

  // 9. 查看团队状态
  console.log('\n=== Team Status ===')
  const status = agentManager.getTeamStatus('demo-team')
  console.log(status)

  // 10. 列出所有任务
  console.log('\n=== All Tasks ===')
  const allTasks = agentManager.listAll()
  console.log(`Total tasks: ${allTasks.length}`)
  for (const task of allTasks) {
    console.log(`  - ${task.id}: ${task.status} (${task.agentType})`)
  }

  // 11. 清理
  console.log('\n=== Cleanup ===')
  agentManager.cleanup(0) // Clean up all completed tasks

  console.log('\n=== Example Complete ===')
}

main().catch(console.error)
