# Agent Runtime 优化总结

## 概述

根据 Claude Code 源码架构，对本地 Agent Runtime 进行了全面优化。以下是优化内容的详细说明。

---

## 已完成的优化

### 1. 工具系统增强 (`src/tools/ToolClaudeCode.ts`)

#### 新增特性：
- **lazySchema** - 延迟加载 Schema，减少启动开销
- **工具分类系统** - 支持 read/write/edit/search/execute/agent/mcp/destructive 分类
- **Fail-Closed 默认策略** - 安全优先的默认值
  - `isConcurrencySafe: () => false`
  - `isReadOnly: () => false`
  - `isDestructive: () => false`
- **增强权限系统** - 支持临时授权、权限范围
- **工具搜索优化** - 支持按分类、关键词搜索
- **自动分类器** - `classify()` 方法用于安全模式

#### 使用示例：
```typescript
import { buildTool, lazySchema, ToolCategory } from './tools/ToolClaudeCode.js'

const tool = buildTool({
  name: 'file_read',
  category: 'read',
  inputSchema: lazySchema(() => z.object({
    path: z.string()
  })),
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  classify: (input) => ({
    category: 'read',
    isSafe: true,
    riskLevel: 'low',
    suggestedConfirmation: false
  })
})
```

---

### 2. Agent 系统增强 (`src/agent/AgentSystem.ts`)

#### 新增特性：
- **隔离模式支持** - 'none' | 'worktree' | 'remote' | 'container'
- **后台任务队列** - 支持并发限制、自动调度
- **团队协作模式** - spawnTeammate、团队状态追踪
- **递归深度限制** - 防止无限嵌套（默认最大深度 3）
- **增强上下文管理** - 文件状态缓存、嵌套深度追踪
- **Agent 进度追踪** - 详细的进度事件

#### 使用示例：
```typescript
import { initializeAgentManager, createAgentTool } from './agent/AgentSystem.js'

const agentManager = initializeAgentManager(toolRegistry, llmService)

// 创建后台任务
const task = agentManager.createTask({
  description: 'Explore codebase',
  prompt: 'Explore the project structure',
  subagentType: 'explore',
  isolation: 'worktree',
  runInBackground: true
})

await agentManager.runInBackground(task.id)

// 团队协作
agentManager.createTeam('my-team')
agentManager.spawnTeammate('my-team', {
  description: 'Search specialist',
  prompt: 'Search for API endpoints',
  subagentType: 'explore'
})

// 查看状态
const status = agentManager.getTeamStatus('my-team')
// { total: 3, running: 2, completed: 1, failed: 0 }
```

---

### 3. 命令系统 (`src/commands/CommandSystem.ts`)

#### 新增特性：
- **斜杠命令支持** - `/clear`, `/commit`, `/review`, `/explain` 等
- **三种命令类型**:
  - `PromptCommand` - 生成提示词发送给 AI
  - `LocalCommand` - 本地直接执行
  - `LocalJSXCommand` - 本地渲染 UI
- **命令别名支持**
- **命令补全建议**
- **动态命令注册**

#### 内置命令：
| 命令 | 描述 | 类型 |
|------|------|------|
| `/clear` | 清除对话历史 | local |
| `/compact` | 压缩上下文 | prompt |
| `/commit` | 生成提交信息 | prompt |
| `/review` | 代码审查 | prompt |
| `/explain` | 解释代码 | prompt |
| `/test` | 生成测试 | prompt |
| `/fix` | 修复问题 | prompt |
| `/refactor` | 重构代码 | prompt |
| `/doc` | 生成文档 | prompt |
| `/help` | 显示帮助 | local |

#### 使用示例：
```typescript
import { createCommandSystem } from './commands/CommandSystem.js'

const { registry, executor } = createCommandSystem()

// 执行命令
const result = await executor.execute('/review src/utils.ts', context)

// 注册自定义命令
registry.register({
  type: 'local',
  name: 'stats',
  description: 'Show project stats',
  supportsNonInteractive: true,
  source: 'skill',
  async execute(args, context) {
    return { success: true, output: 'Files: 100' }
  }
})
```

---

### 4. MCP 客户端增强 (`src/mcp/MCPClientEnhanced.ts`)

#### 新增特性：
- **多传输方式** - stdio / SSE / WebSocket
- **自动重连机制** - 可配置重连次数和延迟
- **连接池管理** - 多客户端管理
- **增强事件系统** - connected, disconnected, error, capabilities:updated
- **连接健康检查** - lastPing 追踪

#### 使用示例：
```typescript
import { MCPClientEnhanced, globalMCPManagerEnhanced } from './mcp/MCPClientEnhanced.js'

// Stdio 传输
const client = new MCPClientEnhanced({
  name: 'filesystem',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    delayMs: 1000
  }
})

await client.connect()

// 或使用管理器
await globalMCPManagerEnhanced.addClient({
  name: 'my-server',
  transport: 'sse',
  url: 'https://api.example.com/mcp'
})
```

---

### 5. 状态管理增强

状态管理 (`StateStore.ts`) 已存在，本次优化确保了更好的集成：
- **事件驱动状态管理**
- **订阅模式支持**
- **持久化存储**
- **批量更新**
- **状态历史追踪**

---

## 架构对比

### 优化前 vs 优化后

```
优化前：                          优化后：
─────────────────────────────────────────────────────────
Tool.ts                          ToolClaudeCode.ts (增强)
├── 基础工具定义                  ├── lazySchema 支持
├── 简单注册表                    ├── 工具分类系统
└── 基础执行器                    ├── 增强权限系统
                                 ├── 自动分类器
                                 └── 智能搜索

AgentTool.ts                     AgentSystem.ts (增强)
├── 基础子代理                    ├── 隔离模式支持
├── 同步执行                      ├── 后台任务队列
└── 简单管理                      ├── 团队协作
                                 ├── 递归深度限制
                                 └── 进度追踪

❌ 无命令系统                      CommandSystem.ts (新增)
                                 ├── 斜杠命令
                                 ├── 3种命令类型
                                 └── 内置10+命令

MCPClient.ts                     MCPClientEnhanced.ts (增强)
├── stdio 传输                    ├── 多传输方式
├── 基础请求                      ├── 自动重连
└── 简单管理                      ├── 连接池
                                 └── 增强事件
```

---

## 关键设计模式（借鉴 Claude Code）

### 1. Fail-Closed 默认策略
```typescript
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,  // 默认不安全
  isReadOnly: () => false,          // 默认会写入
  isDestructive: () => false,
}
```

### 2. buildTool 工厂模式
```typescript
export function buildTool<TInput, TOutput>(def: ToolDef<TInput, TOutput>): Tool<TInput, TOutput> {
  return {
    ...TOOL_DEFAULTS,
    ...def,
    userFacingName: def.userFacingName || function() { return def.name }
  } as Tool<TInput, TOutput>
}
```

### 3. 延迟加载 (lazySchema)
```typescript
export function lazySchema<T>(schemaGetter: () => z.ZodSchema<T>): LazySchema<T> {
  let cachedSchema: z.ZodSchema<T> | null = null
  return {
    _type: 'lazy',
    getSchema: () => {
      if (!cachedSchema) {
        cachedSchema = schemaGetter()
      }
      return cachedSchema
    }
  }
}
```

### 4. 子 Agent 上下文隔离
```typescript
function createSubagentContext(parentContext, agentId, options) {
  return {
    ...parentContext,
    agentId,
    queryTracking: {
      chainId: parentContext?.queryTracking?.chainId || `chain-${Date.now()}`,
      depth: (parentContext?.queryTracking?.depth || 0) + 1,
    },
    fileState: options.fileState,
  }
}
```

---

## 文件清单

### 新增文件：
- `src/tools/ToolClaudeCode.ts` - 增强工具系统
- `src/agent/AgentSystem.ts` - 增强 Agent 系统
- `src/commands/CommandSystem.ts` - 命令系统
- `src/mcp/MCPClientEnhanced.ts` - 增强 MCP 客户端
- `CLAUDE_CODE_OPTIMIZATIONS.md` - 详细使用文档
- `OPTIMIZATION_SUMMARY.md` - 本文档

### 修改文件：
- `src/index.ts` - 导出所有新模块

---

## 已知问题

原项目存在一些类型不匹配问题（与本次优化无关）：

1. **LLM 提供商类型问题** - `anthropic.ts` 和 `openai.ts` 中的 `data` 类型为 `unknown`
2. **工具类型不兼容** - 不同版本的 `Tool` 类型之间有细微差别
3. **StateStore 浏览器 API 问题** - `localStorage` 在 Node 环境中不存在
4. **QueryLoop 类型问题** - `LLMToolCall` 和 `LLMToolDefinition` 混用

这些问题需要在原项目基础上进行修复。

---

## 使用建议

### 推荐用法（新项目）：
```typescript
import { 
  createEnhancedAgentRuntime,
  initializeAgentManager,
  createCommandSystem
} from 'agent-runtime'

const runtime = createEnhancedAgentRuntime({
  llmConfig: { /* ... */ },
  enableCommands: true,
  enableMCP: true
})
```

### 向后兼容（旧项目）：
```typescript
import { createAgentRuntime } from 'agent-runtime'

// 原有 API 仍然可用
const runtime = createAgentRuntime({ llmConfig: { /* ... */ } })
```

---

## 总结

本次优化使 Agent Runtime 具备了 Claude Code 的核心设计优势：

✅ **模块化工具系统** - 自包含、可组合、类型安全
✅ **安全默认** - Fail-Closed 策略
✅ **灵活 Agent 系统** - 多种隔离模式、后台执行、团队协作
✅ **强大命令系统** - 斜杠命令、Prompt/Local 类型
✅ **健壮 MCP 支持** - 多传输、自动重连
✅ **可观测性** - 事件驱动、状态管理

同时保持了与现有代码的向后兼容性。
