# Agent Runtime 快速参考

> 常用代码片段和快速查阅

---

## ToolV2 快速创建

```typescript
import { buildToolV2, createToolResult, createToolError } from '@agenthive/agent-runtime'
import { z } from 'zod'

const tool = buildToolV2({
  name: 'tool_name',
  description: 'Tool description',
  category: 'read', // 'read' | 'write' | 'execute' | 'search' | 'agent' | 'mcp'
  
  inputSchema: z.object({
    param: z.string().describe('Parameter description')
  }),
  
  call: async (input, context, canUseTool, assistantMessage, onProgress) => {
    // 权限检查
    const permission = await canUseTool('tool_name', input)
    if (permission.behavior === 'deny') {
      return createToolError('Permission denied')
    }
    
    // 进度反馈
    onProgress?.({ type: 'start', message: 'Starting...', progress: 0 })
    
    // 执行操作
    const result = await doWork(input)
    
    onProgress?.({ type: 'complete', message: 'Done!', progress: 100 })
    
    return createToolResult(result, {
      resultForAssistant: `Completed: ${JSON.stringify(result)}`
    })
  },
  
  isReadOnly: () => true,
  isConcurrencySafe: () => true
})
```

---

## 注册表操作

```typescript
import { ToolRegistryV2 } from '@agenthive/agent-runtime'

const registry = new ToolRegistryV2()

// 注册
registry.register(tool)

// 获取
const tool = registry.get('tool_name')
const toolByAlias = registry.get('alias')

// 查询
const allTools = registry.listAll()
const readTools = registry.getByCategory('read')
const safeTools = registry.getConcurrencySafeTools()

// 搜索
const results = registry.searchByHint('keyword')
const forTask = registry.searchForTask('I need to read a file')

// LLM 定义
const definitions = registry.getToolDefinitions()
```

---

## 适配器使用

```typescript
import { adaptLegacyToV2, adaptV2ToLegacy } from '@agenthive/agent-runtime'

// 旧 → 新
const modernTool = adaptLegacyToV2(legacyTool)
registry.register(modernTool)

// 新 → 旧
const legacyTool = adaptV2ToLegacy(modernTool)
oldRegistry.register(legacyTool)

// 批量
const modernTools = adaptLegacyToolsToV2([tool1, tool2, tool3])
```

---

## 功能开关

```typescript
import { 
  FEATURE_FLAGS, 
  isFeatureEnabled, 
  enableFeature, 
  disableFeature,
  getFeatureStatus 
} from '@agenthive/agent-runtime'

// 环境变量设置
// AGENT_USE_TOOL_V2=true
// AGENT_ENABLE_AUTO_CLASSIFIER=true

// 运行时检查
if (isFeatureEnabled('USE_TOOL_V2')) {
  // 使用新功能
}

// 运行时启用
enableFeature('ENABLE_CONTEXT_COMPRESSION')

// 运行时禁用
disableFeature('DEBUG')

// 查看状态
console.log(getFeatureStatus())
```

---

## 常用类型

```typescript
// ToolV2 接口
interface ToolV2<TInput, TOutput, TProgress> {
  name: string
  description: string
  category?: ToolCategory
  inputSchema: z.ZodSchema<TInput>
  outputSchema?: z.ZodSchema<TOutput>
  
  call(
    input: TInput,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    assistantMessage: AssistantMessage | null,
    onProgress?: ToolProgressCallback<TProgress>
  ): Promise<ToolResult<TOutput>>
  
  isReadOnly(input: TInput): boolean
  isConcurrencySafe(input: TInput): boolean
}

// 上下文
interface ToolUseContext {
  agentId: string
  workspacePath: string
  sendLog: (message: string, isError?: boolean) => void
  abortController: AbortController
  getAppState: () => AppState
  setAppState: (updater: (prev: AppState) => AppState) => void
  messages: Message[]
  llm: { complete: ..., stream: ... }
}

// 结果
interface ToolResult<T> {
  data: T
  error?: string
  type: 'result' | 'error' | 'cancelled'
  resultForAssistant?: string
}

// 进度
interface ToolProgressData {
  type: string
  message?: string
  progress?: number
  data?: any
}
```

---

## 辅助函数

```typescript
import { 
  createToolResult, 
  createToolError, 
  createToolCancelled,
  lazySchema,
  isToolV2,
  isToolResultError 
} from '@agenthive/agent-runtime'

// 创建结果
const success = createToolResult(data, { resultForAssistant: '...' })
const error = createToolError('Error message')
const cancelled = createToolCancelled()

// 延迟加载 Schema
const schema = lazySchema(() => z.object({...}))

// 类型守卫
if (isToolV2(obj)) { ... }
if (isToolResultError(result)) { ... }
```

---

## QueryLoopV2 使用

```typescript
import { QueryLoopV2, CompactionEngine } from '@agenthive/agent-runtime'

// 创建压缩引擎
const compactionEngine = new CompactionEngine({
  llmService,
  snipThreshold: 8000,
  compactThreshold: 12000,
  collapseThreshold: 16000
})

// 创建 QueryLoopV2
const loop = new QueryLoopV2({
  llmService,
  toolRegistry,
  compactionEngine,
  maxIterations: 20,
  compactionThreshold: 10000,
  enableCompaction: true,
  onProgress: (data) => {
    console.log(`[${data.type}] ${data.message || ''}`)
  }
})

// 监听事件
loop.on('start', ({ userInput }) => console.log('Start:', userInput))
loop.on('content', ({ content }) => console.log('Content:', content))
loop.on('tool_call', ({ name, input }) => console.log('Tool:', name))
loop.on('complete', ({ result }) => console.log('Done!'))
loop.on('error', ({ error }) => console.error('Error:', error))

// 执行查询
const result = await loop.execute('Hello', context, {
  systemPrompt: 'You are a helpful assistant.'
})

console.log({
  success: result.success,
  content: result.content,
  iterations: result.iterations,
  compactionCount: result.compactionCount,
  tokensSaved: result.tokensSaved,
  duration: result.duration
})

// 流式执行
for await (const chunk of loop.stream('Hello', context)) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content)
  }
}

// 停止执行
loop.stop()
```

---

## 上下文压缩

```typescript
import { CompactionEngine, SnipCompactionStrategy } from '@agenthive/agent-runtime'

// 完整引擎
const engine = new CompactionEngine({
  llmService,
  snipThreshold: 8000,      // 触发 snip 压缩
  compactThreshold: 12000,  // 触发摘要压缩
  collapseThreshold: 16000, // 触发完全折叠
  summaryModel: 'gpt-4o-mini'
})

// 自动选择策略
const result = await engine.compact(messages)

// 手动指定策略
const snipResult = await engine.compactWithStrategy(messages, 'snip', {
  ratio: 0.3,
  keepFirstN: 2,
  keepLastN: 4
})

const compactResult = await engine.compactWithStrategy(messages, 'compact', {
  keepRecent: 4
})

const collapseResult = await engine.compactWithStrategy(messages, 'collapse', {
  preserveTask: true
})

// 结果
console.log({
  strategy: result.strategy,
  originalMessages: result.originalMessages,
  compressedMessages: result.messages.length,
  tokensSaved: result.tokensSaved,
  compactionRatio: result.compactionRatio,
  summary: result.summary
})
```

---

## 压缩策略说明

| 策略 | 触发条件 | 行为 | 适用场景 |
|------|---------|------|----------|
| **Snip** | 8K-12K tokens | 移除中间消息，保留首尾 | 快速压缩，保持上下文 |
| **Compact** | 12K-16K tokens | 生成摘要，保留最近消息 | 平衡压缩和质量 |
| **Collapse** | >16K tokens | 完全折叠为摘要 | 极限压缩，保留关键信息 |

---

## MCP 工具

```typescript
const mcpTool = buildToolV2({
  name: 'mcp__server__tool',
  description: 'MCP tool',
  isMcp: true,
  mcpInfo: { 
    serverName: 'my-server', 
    toolName: 'my-tool' 
  },
  inputSchema: z.object({...}),
  call: async (input, context) => {
    // 调用 MCP 服务
    return { data: ..., type: 'result' }
  }
})
```

---

## 测试示例

```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildToolV2 } from '@agenthive/agent-runtime'

describe('My Tool', () => {
  it('should work correctly', async () => {
    const tool = buildToolV2({...})
    
    const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' })
    const mockContext = createMockContext()
    
    const result = await tool.call(
      { param: 'value' },
      mockContext,
      mockCanUseTool,
      null
    )
    
    expect(result.data).toEqual(expected)
    expect(result.type).toBe('result')
  })
})

function createMockContext(): ToolUseContext {
  return {
    agentId: 'test',
    workspacePath: '/test',
    sendLog: () => {},
    abortController: new AbortController(),
    getAppState: () => ({}),
    setAppState: () => {},
    messages: [],
    checkPermission: async () => ({ behavior: 'allow' }),
    llm: {
      complete: async () => ({ content: '' }),
      stream: async function* () {}
    }
  }
}
```

---

## 命令速查

```bash
# 测试
npm test
npm test -- tests/unit/ToolV2.test.ts
npm test -- --coverage

# 构建
npm run build

# 开发
npm run dev
```

---

## 功能开关速查

| 开关 | 环境变量 | 说明 |
|------|----------|------|
| `USE_TOOL_V2` | `AGENT_USE_TOOL_V2` | 使用 ToolV2 接口 |
| `USE_QUERY_LOOP_V2` | `AGENT_USE_QUERY_LOOP_V2` | 使用 QueryLoopV2 |
| `ENABLE_WORKTREE_ISOLATION` | `AGENT_ENABLE_WORKTREE_ISOLATION` | 启用 Worktree 隔离 |
| `ENABLE_CONTEXT_COMPRESSION` | `AGENT_ENABLE_CONTEXT_COMPRESSION` | 启用上下文压缩 |
| `ENABLE_AUTO_CLASSIFIER` | `AGENT_ENABLE_AUTO_CLASSIFIER` | 启用 AutoClassifier |
| `ENABLE_MCP_MINIMAL` | `AGENT_ENABLE_MCP_MINIMAL` | 启用 MCP 最小实现 |
| `DEBUG` | `AGENT_DEBUG` | 调试模式 |

---

*打印此页贴在显示器旁！* 🖨️
