# Claude Code 源码优化总结

本文档总结了从 Claude Code 源码中借鉴的关键设计模式，并说明如何在本地 Agent Runtime 中应用这些优化。

## 优化概览

| 优化项 | 原项目状态 | 优化后状态 | 借鉴的 Claude Code 设计 |
|--------|-----------|-----------|------------------------|
| 工具系统 | 基础版 | ✅ 增强版 | `buildTool` 工厂模式、lazySchema、Fail-Closed 默认策略 |
| Agent 系统 | 基础子代理 | ✅ 完整 Agent 系统 | 隔离模式、后台任务队列、团队协作 |
| 命令系统 | ❌ 缺失 | ✅ 完整实现 | 斜杠命令、Prompt/Local/JSX 命令类型 |
| MCP 客户端 | 基础版 | ✅ 增强版 | 多传输方式、自动重连、连接池 |
| 状态管理 | 基础版 | ✅ 增强版 | Store 模式、订阅机制、持久化 |

---

## 1. 工具系统优化 (`ToolClaudeCode.ts`)

### 1.1 lazySchema - 延迟加载

```typescript
import { lazySchema, resolveSchema } from './tools/ToolClaudeCode.js'
import { z } from 'zod'

// 使用 lazySchema 避免启动时解析开销
const myTool = buildTool({
  name: 'complex_tool',
  description: 'A complex tool',
  // Schema 只有在首次使用时才会被创建
  inputSchema: lazySchema(() => z.object({
    // 复杂的 schema 定义...
  }))
})

// 解析 lazy schema
const actualSchema = resolveSchema(myTool.inputSchema)
```

### 1.2 Fail-Closed 默认策略

```typescript
// 工具默认值 - 安全优先
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,  // 默认不可并发（安全）
  isReadOnly: () => false,          // 默认会写入（安全）
  isDestructive: () => false,
  checkPermissions: (input) => ({ behavior: 'allow', updatedInput: input }),
}
```

### 1.3 工具分类系统

```typescript
import { ToolCategory } from './tools/ToolClaudeCode.js'

const tool = buildTool({
  name: 'file_read',
  category: 'read',  // 自动分类
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  classify: (input) => ({
    category: 'read',
    isSafe: true,
    riskLevel: 'low',
    suggestedConfirmation: false
  })
})

// 按分类搜索工具
const readTools = registry.getByCategory('read')
const searchResults = registry.searchForTask('read files and search code')
```

---

## 2. Agent 系统优化 (`AgentSystem.ts`)

### 2.1 隔离模式

```typescript
import { AgentManager, createAgentTool } from './agent/AgentSystem.js'

// 创建 Agent 管理器
const agentManager = initializeAgentManager(toolRegistry, llmService)

// 支持多种隔离模式
const task = agentManager.createTask({
  description: 'Explore codebase',
  prompt: 'Explore the project structure',
  subagentType: 'explore',
  // 隔离模式: 'none' | 'worktree' | 'remote' | 'container'
  isolation: 'worktree',
  // 继承父代理上下文
  inheritContext: true
})

// 执行
const result = await agentManager.run(task.id)
```

### 2.2 后台任务队列

```typescript
// 后台执行（非阻塞）
await agentManager.runInBackground(task.id)

// 查看后台任务状态
const backgroundTasks = agentManager.listBackground()
const runningTasks = agentManager.listRunning()

// 取消任务
agentManager.cancel(task.id)
```

### 2.3 团队协作模式

```typescript
// 创建团队
const team = agentManager.createTeam('my-team')

// 创建队友（后台自动运行）
const teammate = agentManager.spawnTeammate('my-team', {
  description: 'Search specialist',
  prompt: 'Search for all API endpoints',
  subagentType: 'explore'
})

// 查看团队状态
const status = agentManager.getTeamStatus('my-team')
console.log(status) // { total: 3, running: 2, completed: 1, failed: 0 }
```

### 2.4 嵌套深度限制

```typescript
// 自动防止无限递归
const agentTool = createAgentTool(agentManager)

// 在 checkPermissions 中自动检查
async checkPermissions(input, context) {
  if (context.queryTracking && context.queryTracking.depth >= 3) {
    return {
      behavior: 'deny',
      message: 'Maximum agent nesting depth exceeded (max: 3)'
    }
  }
  return { behavior: 'allow' }
}
```

---

## 3. 命令系统 (`CommandSystem.ts`)

### 3.1 使用内置命令

```typescript
import { createCommandSystem } from './commands/CommandSystem.js'

const { registry, executor } = createCommandSystem()

// 执行命令
const result = await executor.execute('/commit', context)
// 或
const result = await executor.execute('/review src/utils.ts', context)
```

### 3.2 注册自定义命令

```typescript
// Prompt Command - 生成提示词
registry.register({
  type: 'prompt',
  name: 'analyze',
  description: 'Analyze code complexity',
  progressMessage: 'Analyzing...',
  source: 'skill',
  async getPromptForCommand(args, context) {
    return [{
      role: 'user',
      content: `Analyze the complexity of: ${args}`
    }]
  }
})

// Local Command - 本地执行
registry.register({
  type: 'local',
  name: 'stats',
  description: 'Show project stats',
  supportsNonInteractive: true,
  source: 'plugin',
  async execute(args, context) {
    const stats = { files: 100, lines: 5000 }
    return {
      success: true,
      output: `Files: ${stats.files}, Lines: ${stats.lines}`,
      continueToAI: false
    }
  }
})
```

### 3.3 内置命令列表

| 命令 | 描述 | 类型 |
|------|------|------|
| `/clear` | 清除对话历史 | local |
| `/compact` | 压缩上下文 | prompt |
| `/commit [msg]` | 生成提交信息 | prompt |
| `/review [target]` | 代码审查 | prompt |
| `/explain [code]` | 解释代码 | prompt |
| `/test [target]` | 生成测试 | prompt |
| `/fix [issue]` | 修复问题 | prompt |
| `/refactor [target]` | 重构代码 | prompt |
| `/doc [target]` | 生成文档 | prompt |
| `/help` | 显示帮助 | local |

---

## 4. MCP 客户端增强 (`MCPClientEnhanced.ts`)

### 4.1 多传输方式支持

```typescript
import { MCPClientEnhanced } from './mcp/MCPClientEnhanced.js'

// Stdio 传输（本地进程）
const stdioClient = new MCPClientEnhanced({
  name: 'local-server',
  transport: 'stdio',
  command: 'node',
  args: ['server.js']
})

// SSE 传输（HTTP 流）
const sseClient = new MCPClientEnhanced({
  name: 'remote-server',
  transport: 'sse',
  url: 'https://api.example.com/mcp'
})

// WebSocket 传输
const wsClient = new MCPClientEnhanced({
  name: 'ws-server',
  transport: 'websocket',
  url: 'wss://api.example.com/mcp'
})
```

### 4.2 自动重连配置

```typescript
const client = new MCPClientEnhanced({
  name: 'my-server',
  transport: 'stdio',
  command: 'server.js',
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    delayMs: 1000
  }
})

await client.connect()

// 监听连接事件
client.on('disconnected', () => console.log('Disconnected'))
client.on('error', (error) => console.error('Error:', error))
```

---

## 5. 状态管理 (`StateStore.ts`)

已存在，无需修改。但新系统更好地集成了状态管理。

---

## 6. 创建增强版运行时

### 6.1 完整示例

```typescript
import { 
  createEnhancedAgentRuntime,
  initializeStateStore 
} from 'agent-runtime'

// 初始化状态存储
const stateStore = initializeStateStore({
  enabled: true,
  key: 'my-agent-state',
  storage: 'custom',
  customStorage: {
    get: async (key) => await redis.get(key),
    set: async (key, value) => await redis.set(key, value),
    remove: async (key) => await redis.del(key)
  }
})

// 创建增强版运行时
const runtime = createEnhancedAgentRuntime({
  llmConfig: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-sonnet-20240229',
    cache: {
      enabled: true,
      ttlSeconds: 3600
    },
    retry: {
      maxAttempts: 3,
      backoffMultiplier: 2
    }
  },
  workspacePath: '/path/to/project',
  systemPrompt: 'You are a helpful coding assistant.',
  enableCommands: true,  // 启用命令系统
  enableMCP: true        // 启用 MCP
})

// 添加 MCP 服务器
await runtime.mcpManager!.addClient({
  name: 'filesystem',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir']
})

// 使用命令系统
const commandResult = await runtime.commandExecutor!.execute('/commit', {
  agentId: 'main',
  workspacePath: runtime.workspacePath,
  sendLog: (msg, isError) => console.log(msg),
  conversation: {
    getMessages: () => [],
    addMessage: (msg) => console.log(msg)
  }
})

// 执行查询
const context = new ConversationContextV2()
const result = await runtime.queryLoop.execute('Help me refactor this code', context)
```

---

## 7. 迁移指南

### 7.1 从旧版工具系统迁移

```typescript
// 旧方式
import { buildTool } from './tools/ToolEnhanced.js'

// 新方式（推荐）
import { buildTool, lazySchema } from './tools/ToolClaudeCode.js'

const tool = buildTool({
  name: 'my_tool',
  description: 'My tool',
  inputSchema: lazySchema(() => z.object({ ... })), // 使用 lazySchema
  category: 'read',  // 添加分类
  isConcurrencySafe: () => true,  // 明确声明并发安全性
  isReadOnly: () => true,         // 明确声明只读性
  classify: (input) => ({         // 添加分类器
    category: 'read',
    isSafe: true,
    riskLevel: 'low',
    suggestedConfirmation: false
  })
})
```

### 7.2 从旧版 Agent 系统迁移

```typescript
// 旧方式
import { initializeSubAgentManager } from './tools/agent/AgentToolEnhanced.js'

// 新方式（推荐）
import { initializeAgentManager, createAgentTool } from './agent/AgentSystem.js'

const agentManager = initializeAgentManager(toolRegistry, llmService)
const agentTool = createAgentTool(agentManager)

// 现在支持更多功能
const task = agentManager.createTask({
  description: 'Task',
  prompt: 'Do something',
  subagentType: 'explore',
  isolation: 'worktree',        // 隔离模式
  runInBackground: true         // 后台运行
})
```

---

## 8. 架构对比

### 8.1 工具系统对比

```
Claude Code                    Agent Runtime (Optimized)
─────────────────────────────────────────────────────────
Tool.ts                        ToolClaudeCode.ts
├── buildTool()                ├── buildTool() (相同模式)
├── lazySchema()               ├── lazySchema() (新增)
├── TOOL_DEFAULTS              ├── TOOL_DEFAULTS (相同)
│   ├── isConcurrencySafe      │   ├── isConcurrencySafe
│   ├── isReadOnly             │   ├── isReadOnly
│   └── isDestructive          │   └── isDestructive
├── ToolRegistry               ├── ToolRegistry (增强)
│   ├── getByCategory()        │   ├── getByCategory() (新增)
│   ├── searchForTask()        │   ├── searchForTask() (新增)
│   └── getDeferredTools()     │   └── getDeferredTools()
└── classify()                 └── classify() (新增)
```

### 8.2 Agent 系统对比

```
Claude Code                    Agent Runtime (Optimized)
─────────────────────────────────────────────────────────
AgentTool/                     AgentSystem.ts
├── AgentTool                  ├── AgentManager (增强)
├── runAgent.ts                │   ├── run() (同步)
├── runAsyncAgent.ts           │   ├── runInBackground() (队列)
├── spawnTeammate.ts           │   ├── spawnTeammate() (团队)
├── runInWorktree.ts           │   ├── executeWithIsolation()
├── runRemote.ts               │   │   ├── worktree
└── createSubagentContext.ts   │   │   ├── remote
                               │   │   └── container
                               │   └── createSubagentContext()
                               └── createAgentTool()
```

---

## 9. 性能优化建议

1. **使用 lazySchema** - 减少启动时间
2. **启用后台任务** - 避免阻塞主 Agent
3. **使用工具分类** - 更快的工具选择
4. **启用缓存** - LLM 响应缓存
5. **使用连接池** - MCP 客户端复用

---

## 10. 安全最佳实践

1. **Fail-Closed 默认** - 工具默认不安全
2. **权限检查分层** - validateInput → checkPermissions → canUseTool
3. **深度限制** - 防止 Agent 无限递归
4. **隔离模式** - 敏感操作使用 worktree/remote
5. **审计日志** - 记录所有工具调用

---

## 总结

这些优化使本地 Agent Runtime 具备了 Claude Code 的核心设计优势：

- ✅ **模块化工具系统** - 自包含、可组合
- ✅ **安全默认** - Fail-Closed 策略
- ✅ **灵活 Agent 系统** - 多种隔离模式、后台执行
- ✅ **强大命令系统** - 斜杠命令、Prompt/Local 类型
- ✅ **健壮 MCP 支持** - 多传输、自动重连
- ✅ **可观测性** - 事件驱动、状态管理

同时保持了与现有代码的向后兼容性。
