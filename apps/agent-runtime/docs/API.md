# Agent Runtime API 文档

> 版本: 2.2.0 | 最后更新: 2026-04-06

---

## 目录

- [ToolV2 接口](#toolv2-接口)
- [ToolRegistryV2](#toolregistryv2)
- [适配器层](#适配器层)
- [功能开关](#功能开关)
- [迁移指南](#迁移指南)

---

## ToolV2 接口

### 概述

`ToolV2` 是基于 Claude Code 设计的新一代工具接口，提供更完整的权限控制、进度回调和上下文管理。

### 基础用法

```typescript
import { buildToolV2, ToolRegistryV2 } from '@agenthive/agent-runtime'
import { z } from 'zod'

// 创建 ToolV2 工具
const myTool = buildToolV2({
  name: 'file_analyzer',
  description: 'Analyze file content',
  category: 'read',
  
  inputSchema: z.object({
    path: z.string().describe('File path to analyze')
  }),
  
  outputSchema: z.object({
    lines: z.number(),
    words: z.number(),
    characters: z.number()
  }),
  
  // 核心执行方法
  call: async (input, context, canUseTool, assistantMessage, onProgress) => {
    // 1. 检查权限
    const permission = await canUseTool('file_analyzer', input)
    if (permission.behavior === 'deny') {
      return { data: null, error: 'Permission denied', type: 'error' }
    }
    
    // 2. 报告进度
    onProgress?.({ type: 'start', message: 'Reading file...' })
    
    // 3. 执行操作
    const content = await fs.readFile(input.path, 'utf-8')
    
    onProgress?.({ type: 'analyze', message: 'Analyzing content...', progress: 50 })
    
    const stats = {
      lines: content.split('\n').length,
      words: content.split(/\s+/).length,
      characters: content.length
    }
    
    // 4. 返回结果
    return {
      data: stats,
      type: 'result',
      resultForAssistant: `File contains ${stats.lines} lines, ${stats.words} words, ${stats.characters} characters`
    }
  },
  
  // 权限控制
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  
  // 渲染方法
  renderToolUseMessage: (input) => `Analyzing file: ${input.path}`,
  renderToolResultMessage: (output) => `Analyzed: ${output.lines} lines`
})

// 注册到注册表
const registry = new ToolRegistryV2()
registry.register(myTool)
```

### 接口定义

```typescript
interface ToolV2<TInput, TOutput, TProgress> {
  // 基础属性
  name: string
  description: string
  aliases?: string[]
  category?: 'read' | 'write' | 'edit' | 'search' | 'execute' | 'agent' | 'mcp' | 'destructive'
  
  // Schema
  inputSchema: z.ZodSchema<TInput> | LazySchema<TInput>
  outputSchema?: z.ZodSchema<TOutput>
  
  // 核心方法
  call(
    input: TInput,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    assistantMessage: AssistantMessage | null,
    onProgress?: ToolProgressCallback<TProgress>
  ): Promise<ToolResult<TOutput>>
  
  // 权限控制
  checkPermissions(input: TInput, context: ToolUseContext): Promise<PermissionResult>
  isReadOnly(input: TInput): boolean
  isDestructive?(input: TInput): boolean
  isConcurrencySafe(input: TInput): boolean
  
  // 渲染方法（可选）
  renderToolUseMessage?(input: Partial<TInput>): string
  renderToolResultMessage?(output: TOutput): string
  
  // MCP 相关
  isMcp?: boolean
  mcpInfo?: { serverName: string; toolName: string }
}
```

### ToolUseContext

工具执行时的完整上下文：

```typescript
interface ToolUseContext {
  // 基础标识
  agentId: string
  workspacePath: string
  
  // 日志输出
  sendLog: (message: string, isError?: boolean) => void
  
  // 中止控制
  abortController: AbortController
  
  // 应用状态管理
  getAppState: () => AppState
  setAppState: (updater: (prev: AppState) => AppState) => void
  
  // 消息历史
  messages: Message[]
  
  // 查询链追踪（防止递归）
  queryTracking?: QueryChainTracking
  
  // LLM 服务
  llm: {
    complete: (messages: Message[], options?: any) => Promise<LLMResult>
    stream: (messages: Message[], options?: any) => AsyncGenerator<LLMStreamChunk>
  }
}
```

### ToolResult

工具执行结果：

```typescript
interface ToolResult<T> {
  data: T                    // 核心数据
  error?: string             // 错误信息
  type: 'result' | 'error' | 'cancelled'
  resultForAssistant?: string // 给助手的格式化结果
  contextModifier?: (context: ToolUseContext) => ToolUseContext
  mcpMeta?: { ... }          // MCP 元数据
}
```

### 辅助函数

```typescript
import { 
  createToolResult, 
  createToolError, 
  createToolCancelled,
  lazySchema 
} from '@agenthive/agent-runtime'

// 创建成功结果
return createToolResult(data, { 
  resultForAssistant: 'Formatted result' 
})

// 创建错误结果
return createToolError('Something went wrong')

// 创建取消结果
return createToolCancelled()

// 延迟加载 Schema
const mySchema = lazySchema(() => z.object({
  // 复杂的 schema 定义
}))
```

---

## ToolRegistryV2

### 概述

新一代工具注册表，支持 ToolV2 接口，提供更强大的工具管理能力。

### 基础用法

```typescript
import { ToolRegistryV2 } from '@agenthive/agent-runtime'

const registry = new ToolRegistryV2()

// 注册工具
registry.register(myTool)

// 获取工具
const tool = registry.get('file_analyzer')
const toolByAlias = registry.get('fa') // 通过别名

// 列出工具
const allTools = registry.listAll()
const readTools = registry.getByCategory('read')
const safeTools = registry.getConcurrencySafeTools()

// 搜索工具
const results = registry.searchByHint('file')
const forTask = registry.searchForTask('I need to read a file')

// 获取 LLM 工具定义
const definitions = registry.getToolDefinitions()
```

### MCP 工具支持

```typescript
// MCP 工具会自动识别
const mcpTool = buildToolV2({
  name: 'github__create_issue',
  isMcp: true,
  mcpInfo: { serverName: 'github', toolName: 'create_issue' },
  // ...
})

registry.register(mcpTool)

// 获取所有 MCP 工具
const mcpTools = registry.getMCPTools()

// 获取特定客户端的工具
const githubTools = registry.getToolsByMCPClient('github')
```

### 延迟加载

```typescript
// 标记为延迟加载
const heavyTool = buildToolV2({
  name: 'heavy_analysis',
  shouldDefer: true,    // 延迟加载
  alwaysLoad: false,
  // ...
})

registry.register(heavyTool)

// 延迟加载的工具不会出现在工具定义中
const defs = registry.getToolDefinitions() // 不包含 heavy_analysis

// 手动加载
registry.loadDeferredTool('heavy_analysis')
```

---

## 适配器层

### 概述

适配器层提供新旧 Tool 接口的双向转换，确保向后兼容。

### 旧工具升级为新接口

```typescript
import { adaptLegacyToV2, ToolRegistryV2 } from '@agenthive/agent-runtime'

// 你现有的旧工具
const legacyTool = buildTool({
  name: 'my_legacy_tool',
  // ...
})

// 升级到 V2
const modernTool = adaptLegacyToV2(legacyTool)

// 使用新注册表
const registry = new ToolRegistryV2()
registry.register(modernTool)

// 现在可以使用完整的 V2 功能
const result = await modernTool.call(
  input,
  context,
  canUseTool,
  assistantMessage,
  onProgress // 支持进度回调！
)
```

### 新工具降级为旧接口

```typescript
import { adaptV2ToLegacy } from '@agenthive/agent-runtime'

// 新的 V2 工具
const v2Tool = buildToolV2({
  name: 'modern_tool',
  // ...
})

// 降级为旧接口（向后兼容）
const legacyTool = adaptV2ToLegacy(v2Tool)

// 可以在旧系统中使用
const result = await legacyTool.execute(input, context)
```

### 批量转换

```typescript
import { 
  adaptLegacyToolsToV2, 
  adaptV2ToolsToLegacy 
} from '@agenthive/agent-runtime'

// 批量升级
const legacyTools = [tool1, tool2, tool3]
const modernTools = adaptLegacyToolsToV2(legacyTools)

// 批量降级
const v2Tools = [v2Tool1, v2Tool2]
const oldTools = adaptV2ToolsToLegacy(v2Tools)
```

---

## 功能开关

### 概述

功能开关系统允许你渐进式地启用新功能，无需一次性迁移所有代码。

### 环境变量控制

```bash
# 启用 ToolV2
export AGENT_USE_TOOL_V2=true

# 启用 QueryLoopV2
export AGENT_USE_QUERY_LOOP_V2=true

# 启用隔离模式
export AGENT_ENABLE_WORKTREE_ISOLATION=true

# 启用 MCP
export AGENT_ENABLE_MCP_MINIMAL=true
```

### 运行时控制

```typescript
import { 
  FEATURE_FLAGS, 
  isFeatureEnabled, 
  enableFeature, 
  disableFeature 
} from '@agenthive/agent-runtime'

// 检查功能状态
if (isFeatureEnabled('USE_TOOL_V2')) {
  // 使用新功能
}

// 运行时启用
enableFeature('ENABLE_AUTO_CLASSIFIER')

// 运行时禁用
disableFeature('ENABLE_AUTO_CLASSIFIER')

// 查看所有功能状态
console.log(FEATURE_FLAGS)
```

### 功能开关列表

| 开关 | 说明 | 默认 |
|------|------|------|
| `USE_TOOL_V2` | 使用 ToolV2 接口 | `false` |
| `USE_QUERY_LOOP_V2` | 使用 QueryLoopV2 | `false` |
| `ENABLE_WORKTREE_ISOLATION` | 启用 Worktree 隔离 | `false` |
| `ENABLE_CONTEXT_COMPRESSION` | 启用上下文压缩 | `false` |
| `ENABLE_AUTO_CLASSIFIER` | 启用 AutoClassifier | `false` |
| `ENABLE_MCP_MINIMAL` | 启用 MCP 最小实现 | `false` |
| `DEBUG` | 调试模式 | `false` |

---

## 迁移指南

### 从旧 Tool 迁移到 ToolV2

#### 步骤 1: 更新工具定义

**旧代码**:
```typescript
const myTool = buildTool({
  name: 'file_reader',
  description: 'Read file',
  inputSchema: z.object({ path: z.string() }),
  execute: async (input, context) => {
    return await fs.readFile(input.path, 'utf-8')
  },
  isReadOnly: () => true
})
```

**新代码**:
```typescript
const myTool = buildToolV2({
  name: 'file_reader',
  description: 'Read file',
  category: 'read',  // 新增：分类
  inputSchema: z.object({ path: z.string() }),
  
  call: async (input, context, canUseTool, assistantMessage, onProgress) => {
    // 新增：权限检查
    const permission = await canUseTool('file_reader', input)
    if (permission.behavior === 'deny') {
      return { data: null, error: 'Denied', type: 'error' }
    }
    
    // 新增：进度回调
    onProgress?.({ type: 'start', message: 'Reading...' })
    
    const content = await fs.readFile(input.path, 'utf-8')
    
    return {
      data: content,
      type: 'result',
      resultForAssistant: `File content: ${content.slice(0, 100)}...`
    }
  },
  
  isReadOnly: () => true,
  isConcurrencySafe: () => true  // 新增：并发安全标记
})
```

#### 步骤 2: 更新注册表使用

**旧代码**:
```typescript
import { ToolRegistry, registerStandardTools } from '@agenthive/agent-runtime'

const registry = new ToolRegistry()
registerStandardTools(registry)
```

**新代码**:
```typescript
import { ToolRegistryV2, registerStandardTools } from '@agenthive/agent-runtime'

const registry = new ToolRegistryV2()
registerStandardTools(registry)  // 自动检测版本
```

#### 步骤 3: 使用适配器（可选）

如果不想立即迁移所有工具，可以使用适配器：

```typescript
import { adaptLegacyToV2 } from '@agenthive/agent-runtime'

// 混合使用新旧工具
const registry = new ToolRegistryV2()

// 旧工具通过适配器注册
registry.register(adaptLegacyToV2(oldTool1))
registry.register(adaptLegacyToV2(oldTool2))

// 新工具直接注册
registry.register(newV2Tool)
```

### 渐进式迁移策略

```
阶段 1: 并行运行
├── 保持旧代码不变
├── 使用适配器启用新功能
└── 测试验证

阶段 2: 逐步替换
├── 逐个工具迁移到 V2
├── 每迁移一个就测试
└── 保持功能开关控制

阶段 3: 完全迁移
├── 所有工具使用 V2
├── 移除适配器层
└── 废弃旧接口
```

---

## 最佳实践

### 1. 工具设计

```typescript
// ✅ 好的设计
const goodTool = buildToolV2({
  name: 'file_search',
  category: 'search',
  
  // 清晰的输入定义
  inputSchema: z.object({
    pattern: z.string().describe('Search pattern'),
    path: z.string().optional().describe('Search path')
  }),
  
  // 明确的权限声明
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  
  // 进度反馈
  call: async (input, context, canUseTool, assistantMessage, onProgress) => {
    onProgress?.({ type: 'start', message: `Searching for ${input.pattern}...` })
    
    const results = await search(input)
    
    onProgress?.({ type: 'complete', progress: 100, message: `Found ${results.length} matches` })
    
    return { data: results, type: 'result' }
  }
})
```

### 2. 错误处理

```typescript
call: async (input, context) => {
  try {
    const result = await riskyOperation()
    return createToolResult(result)
  } catch (error) {
    // 记录错误日志
    context.sendLog(`Error: ${error.message}`, true)
    
    // 返回结构化错误
    return createToolError(error.message)
  }
}
```

### 3. 权限检查

```typescript
call: async (input, context, canUseTool) => {
  // 总是检查权限
  const permission = await canUseTool(tool.name, input)
  
  switch (permission.behavior) {
    case 'deny':
      return createToolError(permission.message || 'Access denied')
    
    case 'ask':
      // 对于复杂决策，可以返回 defer
      return { 
        data: null, 
        error: 'User confirmation required', 
        type: 'error' 
      }
    
    case 'allow':
    default:
      // 继续执行
      break
  }
  
  // ... 执行工具
}
```

---

## 参考

- [完整类型定义](../src/tools/ToolV2.ts)
- [适配器实现](../src/tools/adapters/ToolAdapter.ts)
- [注册表实现](../src/tools/registry/ToolRegistryV2.ts)
- [功能开关](../src/config/featureFlags.ts)
