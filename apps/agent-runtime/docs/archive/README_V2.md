# Agent Runtime V2 - 增强版

基于 Claude Code 源码优化的 Agent Runtime，集成了完整的工具系统、权限管理和 MCP 协议支持。

## 架构升级

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Agent Runtime V2                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ AgentRuntimeV2  │  │ WebSocketClient │  │TaskExecutorV2   │     │
│  │  (EventEmitter) │◄─┤   (WebSocket)   │◄─┤  (Tool-based)   │     │
│  │                 │  │                 │  │                 │     │
│  │ • Lifecycle Mgmt│  │ • Auto Reconnect│  │ • 12+ Tools     │     │
│  │ • Heartbeat     │  │ • Message Queue │  │ • MCP Support   │     │
│  │ • Task Queue    │  │ • Real-time Comm│  │ • Permissions   │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                    │              │
│           ▼                    ▼                    ▼              │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                      Tool System                              │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │ │
│  │  │ File    │ │ Shell   │ │ Git     │ │ Search  │            │ │
│  │  │ Tools   │ │ Tool    │ │ Tool    │ │ Tools   │            │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │ │
│  │  ┌─────────────────┐ ┌─────────────────┐                    │ │
│  │  │ MCP Client      │ │ PermissionMgr   │                    │ │
│  │  │ (External Tools)│ │ (Access Control)│                    │ │
│  │  └─────────────────┘ └─────────────────┘                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 新增功能

### 1. 工具系统 (Tool System)

参考 Claude Code 的 `buildTool` 模式，提供统一的工具接口：

#### 文件工具
- `file_read` - 读取文件内容，支持偏移和限制
- `file_write` - 写入文件，自动创建目录
- `file_edit` - 精确编辑文件（字符串替换）
- `glob` - 文件搜索（glob 模式）

#### Shell 工具
- `bash` - 执行 Shell 命令，支持权限检查

#### Git 工具
- `git` - 完整的 Git 操作（status, add, commit, push, pull, branch, checkout, log, diff 等）

#### 搜索工具
- `grep` - 代码搜索（正则表达式），支持 ripgrep

### 2. 权限管理系统 (Permission Manager)

支持多种权限模式：

```typescript
type PermissionMode = 
  | 'default'   // 默认模式，敏感操作需要确认
  | 'auto'      // 自动模式，自动允许
  | 'strict'    // 严格模式，所有操作都需要确认
  | 'plan'      // 计划模式，执行计划中的操作
```

内置规则：
- 文件编辑需要确认
- Git push/reset/checkout 需要确认
- 危险的 shell 命令需要确认

### 3. MCP 协议支持

集成 Model Context Protocol 客户端：

```typescript
// 添加 MCP 服务器
await agent.executeCommand({
  type: 'add_mcp',
  payload: {
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']
  }
})
```

### 4. 对话上下文管理

支持多轮对话和上下文压缩：

```typescript
const context = new ConversationContext()
context.addSystemMessage('You are a helpful assistant')
context.addUserMessage('Hello')
context.addAssistantMessage('Hi! How can I help you?')

// 自动压缩当超出 token 限制
const messages = context.toLLMMessages()
```

## 任务类型

### 内置任务类型

| 任务类型 | 说明 |
|----------|------|
| `shell` / `command` | 执行 shell 命令 |
| `file_read` | 读取文件 |
| `file_write` | 写入文件 |
| `file_edit` | 编辑文件 |
| `grep` / `search` | 搜索代码 |
| `git` | Git 操作 |
| `code_generation` | 代码生成 |
| `code_review` | 代码审查 |
| `build` / `deploy` | 构建部署 |
| `test` / `testing` | 测试执行 |
| `multi_tool` | 多工具组合 |

### 直接使用工具

任何注册的工具都可以作为任务类型直接调用：

```json
{
  "type": "bash",
  "input": {
    "command": "ls -la",
    "description": "List files"
  }
}
```

## 使用示例

### 文件操作

```json
// 读取文件
{
  "type": "file_read",
  "input": {
    "path": "/workspace/src/index.ts",
    "offset": 1,
    "limit": 50
  }
}

// 写入文件
{
  "type": "file_write",
  "input": {
    "path": "/workspace/README.md",
    "content": "# Hello World",
    "overwrite": true
  }
}

// 编辑文件
{
  "type": "file_edit",
  "input": {
    "path": "/workspace/package.json",
    "oldString": "\"version\": \"1.0.0\"",
    "newString": "\"version\": \"2.0.0\""
  }
}

// 搜索文件
{
  "type": "glob",
  "input": {
    "pattern": "src/**/*.ts",
    "ignore": ["**/*.test.ts"]
  }
}
```

### Git 操作

```json
// 查看状态
{
  "type": "git",
  "input": {
    "command": "status"
  }
}

// 提交代码
{
  "type": "git",
  "input": {
    "command": "add",
    "args": ["."]
  }
}
{
  "type": "git",
  "input": {
    "command": "commit",
    "args": ["Update files"]
  }
}
```

### 代码搜索

```json
{
  "type": "grep",
  "input": {
    "pattern": "function\s+\w+",
    "path": "/workspace/src",
    "glob": "*.ts",
    "caseSensitive": false
  }
}
```

### 多工具组合

```json
{
  "type": "multi_tool",
  "input": {
    "calls": [
      { "tool": "file_read", "input": { "path": "/workspace/package.json" } },
      { "tool": "bash", "input": { "command": "npm install" } },
      { "tool": "bash", "input": { "command": "npm run build" } }
    ]
  }
}
```

## 扩展工具

### 添加自定义工具

```typescript
import { buildTool, globalToolRegistry } from './tools/Tool.js'
import { z } from 'zod'

const MyTool = buildTool({
  name: 'my_tool',
  description: 'My custom tool',
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    result: z.string()
  }),
  async execute(input, context) {
    context.sendLog(`Processing: ${input.message}`)
    return { result: `Processed: ${input.message}` }
  }
})

globalToolRegistry.register(MyTool)
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_ID` | 随机生成 | Agent 唯一标识 |
| `AGENT_NAME` | Agent {id} | 显示名称 |
| `AGENT_ROLE` | custom | 角色类型 |
| `SUPERVISOR_URL` | ws://localhost:3001 | 管理节点地址 |
| `WORKSPACE_PATH` | /workspace | 工作目录 |
| `MAX_CONCURRENT_TASKS` | 1 | 最大并发任务 |
| `HEARTBEAT_INTERVAL` | 30000 | 心跳间隔(ms) |

## API 命令

通过 WebSocket 发送命令：

```json
{
  "type": "command",
  "payload": {
    "type": "list_tools",
    "payload": {},
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

支持的命令：
- `run_task` - 运行任务
- `cancel_task` - 取消任务
- `pause` / `resume` - 暂停/恢复
- `shutdown` - 关闭 Agent
- `add_mcp` - 添加 MCP 服务器
- `set_permission_mode` - 设置权限模式
- `list_tools` - 列出可用工具

## 与 Claude Code 的对比

| 功能 | Agent Runtime V2 | Claude Code |
|------|------------------|-------------|
| 架构 | 云原生 K8s | 本地 CLI |
| 工具系统 | ✅ 完整的 buildTool 模式 | ✅ buildTool |
| 文件操作 | ✅ 读写编辑 | ✅ 读写编辑 |
| Git 集成 | ✅ simple-git | ✅ 内置 |
| 代码搜索 | ✅ grep/ripgrep | ✅ ripgrep |
| MCP 协议 | ✅ 支持 | ✅ 支持 |
| 权限系统 | ✅ 多模式 | ✅ 多模式 |
| 上下文管理 | ✅ 自动压缩 | ✅ 自动压缩 |
| LSP 支持 | ❌ 待实现 | ✅ 内置 |
| Web 搜索 | ❌ 待实现 | ✅ 内置 |
| Agent 子系统 | ⚠️ 简化版 | ✅ 完整 |

## 运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm start
```

## Docker 部署

```bash
# 构建镜像
npm run docker:build

# Kubernetes 部署
npm run k8s:deploy
```
