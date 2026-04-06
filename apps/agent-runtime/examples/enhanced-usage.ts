// Enhanced Agent Runtime 使用示例
// 展示优化版 Agent Runtime 的所有新特性

import {
  AgentRuntimeEnhanced,
  createAgentRuntime,
  ConversationContextV2,
  QueryLoop,
  SubAgentManager
} from '../src/index-enhanced.js'

// ============ 1. 基础初始化 ============

const runtime = createAgentRuntime({
  llm: {
    defaultProvider: {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-5-sonnet-20241022'
    },
    fallbackProvider: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o'
    },
    enableCache: true,
    cacheTTL: 3600
  },
  agent: {
    maxIterations: 20,
    enableStreaming: true,
    tokenBudget: {
      maxTokensPerTurn: 8000,
      warningThreshold: 0.8,
      enableAutoContinue: true
    }
  },
  subAgent: {
    enableAsync: true,
    enableIsolation: true
  }
})

// ============ 2. 简单查询 ============

async function basicQuery() {
  const result = await runtime.execute(
    'Explain how React hooks work',
    {
      systemPrompt: 'You are a helpful programming assistant.',
      model: 'claude-3-5-sonnet-20241022'
    }
  )

  console.log('Result:', result.content)
  console.log('Iterations:', result.iterations)
  console.log('Token usage:', result.usage)
}

// ============ 3. 流式查询 ============

async function streamingQuery() {
  const stream = runtime.stream(
    'Write a function to sort an array',
    {
      systemPrompt: 'You are a code assistant. Output only code.'
    }
  )

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'content':
        process.stdout.write(chunk.content)
        break
      case 'tool_call':
        console.log(`\n[Tool: ${chunk.toolName}]`)
        break
      case 'tool_result':
        console.log(`\n[Tool result received]`)
        break
      case 'error':
        console.error('\n[Error]:', chunk.error)
        break
    }
  }
}

// ============ 4. 使用子代理 ============

async function useSubAgent() {
  // 执行代码专家代理
  const result = await runtime.executeAgent(
    'coder',
    'Write a TypeScript function to implement binary search with proper type definitions',
    {
      model: 'claude-3-5-sonnet-20241022',
      maxIterations: 15,
      temperature: 0.2
    }
  )

  console.log('Agent completed:', result.success)
  console.log('Content:', result.content)
  console.log('Tool calls:', result.toolCalls.length)
  console.log('Duration:', result.duration, 'ms')
}

// ============ 5. 流式子代理 ============

async function streamingSubAgent() {
  const stream = runtime.streamAgent(
    'explorer',
    'Explore the codebase to understand the project structure',
    {
      forkContext: true // 在隔离的上下文中运行
    }
  )

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'content':
        process.stdout.write(chunk.content)
        break
      case 'tool_call':
        console.log(`\n[Agent using tool: ${chunk.toolName}]`)
        break
      case 'complete':
        console.log('\n[Agent completed]', chunk.result)
        break
      case 'error':
        console.error('\n[Agent error]:', chunk.error)
        break
    }
  }
}

// ============ 6. 使用增强版 Agent Tool ============

import { z } from 'zod'
import { buildTool } from '../src/tools/Tool.js'

// 创建一个使用 agent_enhanced 工具的示例
async function useAgentTool() {
  // 注册一些示例工具
  const bashTool = buildTool({
    name: 'bash',
    description: 'Execute bash commands',
    inputSchema: z.object({
      command: z.string(),
      timeout: z.number().optional()
    }),
    outputSchema: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number()
    }),
    async execute(input, context) {
      // 模拟执行
      return { stdout: 'Output', stderr: '', exitCode: 0 }
    }
  })

  runtime.registerTool(bashTool)

  // 现在 agent_enhanced 工具可以使用 bash 工具
  // 在对话中，LLM 可能会这样调用：
  // agent_enhanced({
  //   description: "Check git status",
  //   prompt: "Run git status and analyze the output",
  //   agentType: "coder",
  //   maxIterations: 10
  // })
}

// ============ 7. 上下文管理 ============

async function contextManagement() {
  // 创建持久化上下文
  const context = runtime.createContext({ maxTokens: 16000 })

  // 第一轮对话
  const result1 = await runtime.execute(
    'What is the capital of France?',
    { context }
  )

  // 第二轮对话（上下文被保留）
  const result2 = await runtime.execute(
    'What is its population?',  // 能够理解 "its" 指的是 Paris
    { context }
  )

  // 查看上下文统计
  const stats = context.getStats()
  console.log('Total messages:', stats.totalMessages)
  console.log('Total tokens:', stats.totalTokens)
  console.log('Compression ratio:', stats.compressionRatio + '%')

  // 查看压缩历史
  const history = context.getCompressionHistory()
  console.log('Compression events:', history.length)
}

// ============ 8. 带工具调用的完整示例 ============

async function fullExample() {
  // 创建对话上下文
  const context = new ConversationContextV2()
  context.setSystemPrompt(`You are a helpful coding assistant. You have access to:
- file_read: Read file contents
- file_write: Write files
- grep: Search text
- bash: Execute commands
- agent_enhanced: Create specialized sub-agents

Use the agent_enhanced tool when you need specialized help:
- coder: For writing/editing code
- explorer: For exploring codebases
- planner: For breaking down complex tasks
- reviewer: For code review`)

  // 执行带工具调用的对话
  const result = await runtime.execute(
    'I need to refactor this codebase to use TypeScript. First, explore the structure, then create a plan.',
    { context }
  )

  // 在这个对话中，LLM 可能会：
  // 1. 调用 agent_enhanced({ agentType: 'explorer', ... }) 探索代码
  // 2. 调用 agent_enhanced({ agentType: 'planner', ... }) 创建计划
  // 3. 基于结果给出建议

  console.log('Final response:', result.content)
  console.log('Tool calls made:')
  for (const call of result.toolCalls) {
    console.log(`  - ${call.name}: ${JSON.stringify(call.input).slice(0, 100)}`)
  }
}

// ============ 9. 获取运行时统计 ============

async function getStats() {
  const stats = runtime.getStats()

  console.log('=== LLM Metrics ===')
  console.log('Total requests:', stats.llm.totalRequests)
  console.log('Total tokens:', stats.llm.totalTokens)
  console.log('Errors:', stats.llm.errors)
  console.log('Cache hit rate:', (stats.llm.cacheHitRate * 100).toFixed(2) + '%')
  console.log('Average cost per request: $', stats.llm.averageCost.toFixed(4))

  console.log('\n=== Cost Breakdown ===')
  console.log('Total cost: $', stats.cost.totalCost.toFixed(4))
  
  for (const [model, data] of Object.entries(stats.cost.byModel)) {
    console.log(`  ${model}: $${data.cost.toFixed(4)} (${data.tokens} tokens, ${data.requests} requests)`)
  }

  console.log('\n=== Active Agents ===')
  console.log('Active agents:', stats.activeAgents)
}

// ============ 10. 批量处理 ============

async function batchProcessing() {
  const tasks = [
    'Explain closures in JavaScript',
    'Write a regex for email validation',
    'Compare REST vs GraphQL'
  ]

  const results = await Promise.all(
    tasks.map(task => runtime.execute(task))
  )

  for (let i = 0; i < tasks.length; i++) {
    console.log(`\nTask ${i + 1}: ${tasks[i]}`)
    console.log('Result:', results[i].content.slice(0, 200) + '...')
  }
}

// ============ 运行示例 ============

async function main() {
  try {
    console.log('=== Running Enhanced Agent Runtime Examples ===\n')

    // 基础查询
    console.log('1. Basic Query:')
    await basicQuery()

    // 子代理
    console.log('\n2. Sub-Agent:')
    await useSubAgent()

    // 统计
    console.log('\n3. Stats:')
    await getStats()

    // 清理
    runtime.stop()
    console.log('\n=== Examples completed ===')

  } catch (error) {
    console.error('Error running examples:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {
  basicQuery,
  streamingQuery,
  useSubAgent,
  streamingSubAgent,
  contextManagement,
  fullExample,
  getStats,
  batchProcessing
}
