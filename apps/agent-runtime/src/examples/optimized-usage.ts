// 优化后的 Agent Runtime 使用示例
// 展示如何使用参考 Claude Code 优化后的新特性

import {
  // 创建运行时
  createAgentRuntime,
  quickQuery,
  
  // LLM 服务
  LLMServiceEnhanced,
  initializeLLMServiceEnhanced,
  RECOMMENDED_PRODUCTION_CONFIG,
  
  // 工具系统
  ToolRegistry,
  ToolOrchestrator,
  createStandardToolRegistry,
  registerStandardTools,
  
  // Agent 系统
  SubAgentManager,
  initializeSubAgentManager,
  BUILTIN_AGENTS,
  
  // Query Loop
  QueryLoop,
  
  // 上下文
  ConversationContextV2
} from '../index.js'

// ============================================================================
// 示例 1: 基础使用 - 创建运行时并执行查询
// ============================================================================

async function basicUsage() {
  console.log('=== 示例 1: 基础使用 ===')
  
  // 创建运行时
  const runtime = createAgentRuntime({
    llmConfig: {
      defaultProvider: {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: 'claude-3-sonnet-20240229'
      },
      enableCache: true,
      cacheTTL: 3600,
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableErrors: ['network', 'rate_limit', 'server']
      }
    },
    workspacePath: process.cwd()
  })
  
  // 执行查询
  const context = new ConversationContextV2()
  const result = await runtime.queryLoop.execute(
    '请读取当前目录下的 package.json 文件并告诉我项目名称',
    context
  )
  
  console.log('结果:', result.content)
  console.log('迭代次数:', result.iterations)
  console.log('工具调用:', result.toolCalls)
  
  // 查看缓存统计
  console.log('缓存统计:', runtime.llmService.getCacheStats())
}

// ============================================================================
// 示例 2: 使用子代理 (Agent) - 参考 Claude Code 的设计
// ============================================================================

async function subAgentUsage() {
  console.log('\n=== 示例 2: 使用子代理 ===')
  
  const runtime = createAgentRuntime({
    llmConfig: RECOMMENDED_PRODUCTION_CONFIG
  })
  
  // 使用 explore 子代理探索代码库
  const exploreResult = await runtime.subAgentManager.run(
    runtime.subAgentManager.createTask({
      agentType: 'explore',
      prompt: '探索 src 目录的结构，了解项目的主要组件和架构',
      options: {
        maxIterations: 10
      }
    }).id
  )
  
  console.log('探索结果:', exploreResult.content)
  console.log('工具调用次数:', exploreResult.toolCalls.length)
  
  // 使用 plan 子代理创建实现计划
  const planResult = await runtime.subAgentManager.run(
    runtime.subAgentManager.createTask({
      agentType: 'plan',
      prompt: '计划如何添加一个新的工具到工具系统',
      options: {
        maxIterations: 8
      }
    }).id
  )
  
  console.log('计划结果:', planResult.content)
}

// ============================================================================
// 示例 3: 使用 ToolOrchestrator 优化工具执行
// ============================================================================

async function toolOrchestratorUsage() {
  console.log('\n=== 示例 3: 工具协调器 ===')
  
  const toolRegistry = createStandardToolRegistry()
  const orchestrator = new ToolOrchestrator(toolRegistry, {
    maxConcurrency: 5,
    timeout: 120000,
    preserveOrder: true
  })
  
  // 准备一批工具调用
  const toolCalls = [
    { id: '1', name: 'file_read', input: { path: '/package.json' } },
    { id: '2', name: 'file_read', input: { path: '/tsconfig.json' } },  // 可并发
    { id: '3', name: 'grep', input: { pattern: 'export', glob: '*.ts' } }, // 可并发
    { id: '4', name: 'file_write', input: { path: '/test.txt', content: 'hello' } }, // 串行
    { id: '5', name: 'file_edit', input: { path: '/test.txt', oldString: 'hello', newString: 'world' } } // 串行
  ]
  
  // 执行（自动分区为并发和串行批次）
  const results = await orchestrator.executeToolCalls(toolCalls, {
    agentId: 'orchestrator-demo',
    workspacePath: process.cwd(),
    sendLog: (msg) => console.log('[LOG]', msg)
  })
  
  console.log('执行结果:', results.map(r => ({
    name: r.name,
    status: r.status,
    duration: r.duration
  })))
}

// ============================================================================
// 示例 4: 增强版 LLM Service - 重试和缓存
// ============================================================================

async function enhancedLLMServiceUsage() {
  console.log('\n=== 示例 4: 增强版 LLM Service ===')
  
  const llmService = initializeLLMServiceEnhanced({
    defaultProvider: {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-haiku-20240307'
    },
    fallbackProvider: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4'
    },
    enableCache: true,
    cacheTTL: 3600,
    maxCacheSize: 1000,
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: ['network', 'rate_limit', 'server']
    },
    enableMetrics: true
  })
  
  // 监听事件
  llmService.on('cache:hit', (data) => {
    console.log('缓存命中!', data.provider)
  })
  
  llmService.on('completion:retry', (data) => {
    console.log(`重试第 ${data.attempt} 次...`)
  })
  
  llmService.on('completion:fallback', (data) => {
    console.log(`切换到备用 Provider: ${data.to}`)
  })
  
  // 执行请求（会自动重试和缓存）
  const result1 = await llmService.complete([
    { role: 'user', content: 'Hello, how are you?' }
  ])
  
  console.log('第一次响应:', result1.content?.slice(0, 100))
  
  // 第二次请求（应该命中缓存）
  const result2 = await llmService.complete([
    { role: 'user', content: 'Hello, how are you?' }
  ])
  
  console.log('第二次响应 (缓存):', result2.content?.slice(0, 100))
  
  // 查看指标
  console.log('性能指标:', llmService.getMetrics())
  console.log('缓存统计:', llmService.getCacheStats())
}

// ============================================================================
// 示例 5: 快速查询 - 最简单的使用方式
// ============================================================================

async function quickQueryUsage() {
  console.log('\n=== 示例 5: 快速查询 ===')
  
  try {
    const response = await quickQuery(
      'Explain what this project does',
      {
        llmConfig: {
          defaultProvider: {
            provider: 'anthropic',
            apiKey: process.env.ANTHROPIC_API_KEY || '',
            model: 'claude-3-haiku-20240307'
          }
        },
        systemPrompt: 'You are a helpful assistant.'
      }
    )
    
    console.log('快速查询结果:', response.slice(0, 200))
  } catch (error) {
    console.error('快速查询失败:', error)
  }
}

// ============================================================================
// 示例 6: 流式输出
// ============================================================================

async function streamingUsage() {
  console.log('\n=== 示例 6: 流式输出 ===')
  
  const runtime = createAgentRuntime({
    llmConfig: RECOMMENDED_PRODUCTION_CONFIG
  })
  
  const context = new ConversationContextV2()
  
  console.log('开始流式输出:')
  for await (const chunk of runtime.queryLoop.stream(
    'Write a short poem about coding',
    context
  )) {
    if (chunk.type === 'content' && chunk.content) {
      process.stdout.write(chunk.content)
    } else if (chunk.type === 'tool_call') {
      console.log('\n[工具调用]', chunk.toolName)
    }
  }
  console.log('\n流式输出完成')
}

// ============================================================================
// 示例 7: 自定义工具
// ============================================================================

import { z } from 'zod'
import { buildTool } from '../tools/ToolEnhanced.js'

async function customToolUsage() {
  console.log('\n=== 示例 7: 自定义工具 ===')
  
  // 定义自定义工具
  const WeatherTool = buildTool({
    name: 'get_weather',
    description: 'Get weather information for a location',
    searchHint: 'weather forecast temperature',
    inputSchema: z.object({
      location: z.string().describe('City name'),
      unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
    }),
    outputSchema: z.object({
      temperature: z.number(),
      condition: z.string(),
      humidity: z.number()
    }),
    
    // 安全标记
    isConcurrencySafe: () => true,
    isReadOnly: () => true,
    isDestructive: () => false,
    
    async execute(input) {
      // 模拟天气 API 调用
      return {
        temperature: 22,
        condition: 'Sunny',
        humidity: 60
      }
    },
    
    renderToolUseMessage(input) {
      return `Getting weather for ${input.location}`
    },
    
    renderToolResultMessage(result) {
      return `Weather: ${result.condition}, ${result.temperature}°C`
    }
  })
  
  // 注册自定义工具
  const runtime = createAgentRuntime({
    llmConfig: RECOMMENDED_PRODUCTION_CONFIG
  })
  
  runtime.toolRegistry.register(WeatherTool)
  
  console.log('已注册自定义工具:', runtime.toolRegistry.list())
}

// ============================================================================
// 运行所有示例
// ============================================================================

async function runAllExamples() {
  console.log('Agent Runtime 优化版使用示例')
  console.log('=============================\n')
  
  try {
    // 注意：以下示例需要有效的 API 密钥才能运行
    // await basicUsage()
    // await subAgentUsage()
    // await toolOrchestratorUsage()
    // await enhancedLLMServiceUsage()
    // await quickQueryUsage()
    // await streamingUsage()
    await customToolUsage()
    
    console.log('\n所有示例执行完成!')
  } catch (error) {
    console.error('示例执行失败:', error)
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples()
}

export {
  basicUsage,
  subAgentUsage,
  toolOrchestratorUsage,
  enhancedLLMServiceUsage,
  quickQueryUsage,
  streamingUsage,
  customToolUsage
}
