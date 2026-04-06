/**
 * Enhanced Tools 使用示例
 * 
 * 展示如何使用参考 Claude Code 优化的工具系统
 */

import { 
  createEnhancedToolRegistry,
  ToolOrchestrator,
  QueryLoopEnhanced,
  type ToolCall,
} from '../src/tools/indexEnhanced.js'
import { ConversationContextV2 } from '../src/context/ConversationContextV2.js'
import { LLMService } from '../src/services/llm/LLMService.js'

// ============================================================================
// 示例 1：创建并使用增强工具注册表
// ============================================================================

async function example1_basicUsage() {
  console.log('=== 示例 1：基本使用 ===\n')
  
  // 创建预配置的工具注册表
  const registry = createEnhancedToolRegistry()
  
  // 查看注册的工具
  console.log('已注册工具:', registry.list())
  console.log('工具详情:', registry.getToolDefinitions())
}

// ============================================================================
// 示例 2：使用 ToolOrchestrator 并行执行工具
// ============================================================================

async function example2_parallelExecution() {
  console.log('\n=== 示例 2：并行执行工具 ===\n')
  
  const registry = createEnhancedToolRegistry()
  
  // 创建协调器
  const orchestrator = new ToolOrchestrator(registry, {
    maxConcurrency: 5,
    timeout: 60000,
    preserveOrder: true,
  })
  
  // 模拟工具调用 - 多个读取操作可以并行
  const toolCalls: ToolCall[] = [
    { id: '1', name: 'file_read', input: { path: 'package.json' } },
    { id: '2', name: 'file_read', input: { path: 'tsconfig.json' } },
    { id: '3', name: 'glob', input: { pattern: 'src/**/*.ts' } },
    { id: '4', name: 'grep', input: { pattern: 'export', path: 'src/', include: '*.ts' } },
  ]
  
  // 创建工具上下文
  const context = {
    agentId: 'example-agent',
    workspacePath: process.cwd(),
    sendLog: (msg: string, isError = false) => {
      console.log(isError ? `[ERROR] ${msg}` : `[LOG] ${msg}`)
    }
  }
  
  console.log('开始执行 4 个工具调用（自动分区并行）...\n')
  
  // 执行 - 读取操作会自动并行执行
  const results = await orchestrator.executeToolCalls(toolCalls, context)
  
  for (const result of results) {
    if (result.status === 'completed') {
      console.log(`✓ ${result.name}: ${result.duration}ms`)
    } else {
      console.log(`✗ ${result.name}: ${result.error}`)
    }
  }
}

// ============================================================================
// 示例 3：流式执行并追踪进度
// ============================================================================

async function example3_streamingExecution() {
  console.log('\n=== 示例 3：流式执行 ===\n')
  
  const registry = createEnhancedToolRegistry()
  const orchestrator = new ToolOrchestrator(registry)
  
  const toolCalls: ToolCall[] = [
    { id: '1', name: 'file_read', input: { path: 'README.md' } },
    { id: '2', name: 'glob', input: { pattern: '*.md' } },
    { id: '3', name: 'grep', input: { pattern: 'TODO', path: '.' } },
  ]
  
  const context = {
    agentId: 'example-agent',
    workspacePath: process.cwd(),
    sendLog: () => {}
  }
  
  console.log('流式执行，实时追踪进度...\n')
  
  for await (const item of orchestrator.executeToolCallsStream(toolCalls, context)) {
    if ('type' in item) {
      // 进度更新
      console.log(`[进度] ${item.toolName}: ${item.type}`)
    } else {
      // 结果
      console.log(`[结果] ${item.name}: ${item.status} (${item.duration}ms)`)
    }
  }
}

// ============================================================================
// 示例 4：混合读写操作（自动分区串行执行写入）
// ============================================================================

async function example4_mixedOperations() {
  console.log('\n=== 示例 4：混合读写操作 ===\n')
  
  const registry = createEnhancedToolRegistry()
  const orchestrator = new ToolOrchestrator(registry)
  
  // 混合读写操作
  const toolCalls: ToolCall[] = [
    // 第一批：读取操作（并行）
    { id: '1', name: 'file_read', input: { path: 'template.txt' } },
    { id: '2', name: 'file_read', input: { path: 'config.json' } },
    
    // 第二批：写入操作（串行）
    { id: '3', name: 'file_write', input: { path: 'output.txt', content: '...' } },
    
    // 第三批：读取操作（并行）
    { id: '4', name: 'grep', input: { pattern: 'test', path: 'src/' } },
  ]
  
  const context = {
    agentId: 'example-agent',
    workspacePath: process.cwd(),
    sendLog: (msg: string) => console.log(`  ${msg}`)
  }
  
  console.log('执行混合读写操作（读取并行，写入串行）...\n')
  
  const results = await orchestrator.executeToolCalls(toolCalls, context)
  
  for (const result of results) {
    const icon = result.status === 'completed' ? '✓' : '✗'
    console.log(`${icon} [${result.id}] ${result.name}: ${result.duration}ms`)
  }
}

// ============================================================================
// 示例 5：使用增强版 QueryLoop
// ============================================================================

async function example5_queryLoop() {
  console.log('\n=== 示例 5：增强版 QueryLoop ===\n')
  
  const registry = createEnhancedToolRegistry()
  
  // 模拟 LLM 服务
  const mockLLMService = {
    complete: async () => ({
      content: 'Here is the result',
      toolCalls: [
        {
          id: 'call_1',
          function: {
            name: 'file_read',
            arguments: JSON.stringify({ path: 'package.json' })
          }
        },
        {
          id: 'call_2',
          function: {
            name: 'glob',
            arguments: JSON.stringify({ pattern: 'src/**/*.ts' })
          }
        }
      ],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
    }),
    stream: async function* () {
      yield { content: 'Analyzing...', done: false }
      yield { content: ' Done!', done: false }
      yield { content: '', toolCalls: [], done: true }
    }
  } as unknown as LLMService
  
  // 创建增强版 QueryLoop
  const queryLoop = new QueryLoopEnhanced({
    llmService: mockLLMService,
    toolRegistry: registry,
    maxIterations: 10,
    orchestratorConfig: {
      maxConcurrency: 5,
      timeout: 60000,
    },
    onProgress: (data) => {
      switch (data.type) {
        case 'thinking':
          console.log(`[思考] 迭代 ${data.iteration}`)
          break
        case 'content':
          console.log(`[内容] ${data.content}`)
          break
        case 'tool_batch_start':
          console.log(`[批次开始] ${data.batchSize} 个工具${data.isConcurrent ? '（并行）' : '（串行）'}`)
          break
        case 'tool_result':
          console.log(`[工具结果] ${data.toolName}: ${data.error ? '失败' : '成功'}`)
          break
        case 'complete':
          console.log(`[完成] 总耗时 ${data.totalDuration}ms`)
          break
      }
    }
  })
  
  const conversationContext = new ConversationContextV2()
  
  console.log('执行查询循环...\n')
  
  const result = await queryLoop.execute(
    '请分析项目结构',
    conversationContext,
    {
      systemPrompt: '你是一个代码分析助手。'
    }
  )
  
  console.log('\n查询结果:', {
    success: result.success,
    content: result.content.slice(0, 100) + '...',
    toolCalls: result.toolCalls.length,
    duration: result.duration
  })
}

// ============================================================================
// 示例 6：工具统计和分类
// ============================================================================

async function example6_toolStats() {
  console.log('\n=== 示例 6：工具统计 ===\n')
  
  const registry = createEnhancedToolRegistry()
  
  // 导入统计函数
  const { getToolStats, categorizeToolsByConcurrency, categorizeToolsByOperation } = 
    await import('../src/tools/indexEnhanced.js')
  
  // 获取统计
  const stats = getToolStats(registry)
  console.log('工具统计:', stats)
  
  // 按并发安全性分类
  const byConcurrency = categorizeToolsByConcurrency(registry.getAllTools())
  console.log('\n可并发工具:', byConcurrency.concurrentSafe.map(t => t.name))
  console.log('串行工具:', byConcurrency.serialOnly.map(t => t.name))
  
  // 按操作类型分类
  const byOperation = categorizeToolsByOperation(registry.getAllTools())
  console.log('\n只读工具:', byOperation.readOnly.map(t => t.name))
  console.log('写入工具:', byOperation.write.map(t => t.name))
  console.log('破坏性工具:', byOperation.destructive.map(t => t.name))
}

// ============================================================================
// 示例 7：自定义工具
// ============================================================================

async function example7_customTool() {
  console.log('\n=== 示例 7：自定义工具 ===\n')
  
  import { z } from 'zod'
  import { buildTool } from '../src/tools/ToolEnhanced.js'
  
  // 创建自定义工具
  const CalculatorTool = buildTool({
    name: 'calculator',
    description: 'Perform mathematical calculations',
    
    inputSchema: z.object({
      expression: z.string().describe('Mathematical expression to evaluate')
    }),
    outputSchema: z.object({
      result: z.number(),
      expression: z.string()
    }),
    
    // 元数据
    aliases: ['calc', 'math'],
    searchHint: 'calculate math expression',
    
    // 计算是并发安全的
    isConcurrencySafe: () => true,
    isReadOnly: () => true,
    
    // 用户友好名称
    userFacingName: (input) => `Calculate "${input?.expression}"`,
    
    // 执行
    execute: async (input, context) => {
      // 安全评估数学表达式
      const sanitized = input.expression.replace(/[^0-9+\-*/().\s]/g, '')
      // eslint-disable-next-line no-eval
      const result = eval(sanitized)
      
      return {
        result,
        expression: input.expression
      }
    },
    
    renderToolUseMessage: (input) => `🧮 Calculate: ${input.expression}`,
    renderToolResultMessage: (result) => `✓ ${result.expression} = ${result.result}`
  })
  
  console.log('创建自定义工具:', CalculatorTool.name)
  console.log('别名:', CalculatorTool.aliases)
  console.log('并发安全:', CalculatorTool.isConcurrencySafe({}))
  
  // 注册并使用
  const registry = createEnhancedToolRegistry()
  registry.register(CalculatorTool)
  
  // 通过别名查找
  const found = registry.get('calc')  // 使用别名
  console.log('通过别名查找:', found?.name)
}

// ============================================================================
// 运行所有示例
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║         Enhanced Tools 使用示例                               ║')
  console.log('║         参考 Claude Code 设计优化                             ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
  
  try {
    await example1_basicUsage()
    // 注意：以下示例需要实际文件系统，可能在某些环境失败
    // await example2_parallelExecution()
    // await example3_streamingExecution()
    // await example4_mixedOperations()
    await example5_queryLoop()
    await example6_toolStats()
    await example7_customTool()
    
    console.log('\n\n✅ 所有示例执行完成！')
    
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error)
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main }
