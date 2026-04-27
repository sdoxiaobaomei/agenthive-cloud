# Chat 控制器设计文档

## 1. 目标

用户通过自然语言 Chat 界面，指挥 AI Agent 团队完成软件开发。整个流程如下：

```
用户输入需求
    ↓
[Chat Controller] 解析意图（需求分析 / 代码生成 / 代码审查 / 测试 / 部署）
    ↓
[Orchestrator] 拆解为 Tickets
    ↓
[Worker Agents] 并行执行（Frontend Dev / Backend Dev / QA Engineer）
    ↓
[Agent Runtime] 在隔离 Workspace 中执行 LLM + Tool 调用
    ↓
[Chat Controller] 汇总结果，向用户汇报
```

## 2. Chat Controller 模块 (apps/api/src/chat-controller/)

### 2.1 核心功能

| 功能 | 说明 |
|------|------|
| 意图识别 | 识别用户输入是"创建项目"、"修改代码"、"运行测试"还是"普通聊天" |
| 上下文管理 | 维护多轮对话上下文，关联当前项目/Workspace |
| Agent 调度 | 调用 Orchestrator 生成 Plan，分发给 Workers |
| 进度推送 | 通过 WebSocket 实时推送 Agent 执行进度 |
| 结果汇总 | 收集各 Worker 结果，生成人类可读的汇报 |

### 2.2 数据模型

```typescript
interface ChatSession {
  id: string
  userId: string
  projectId?: string
  messages: ChatMessage[]
  status: 'active' | 'archived'
  createdAt: Date
  updatedAt: Date
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  content: string
  metadata?: {
    intent?: string
    tickets?: Ticket[]
    progress?: number
    agentLogs?: AgentLog[]
  }
  timestamp: Date
}

interface AgentTask {
  id: string
  sessionId: string
  ticketId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  assignedTo: 'frontend' | 'backend' | 'qa'
  workspacePath: string
  result?: AgentResult
}
```

### 2.3 API 设计

```
POST   /api/chat/sessions              → 创建会话
GET    /api/chat/sessions              → 获取会话列表
GET    /api/chat/sessions/:id          → 获取会话详情
POST   /api/chat/sessions/:id/messages → 发送消息
GET    /api/chat/sessions/:id/messages → 获取消息列表
POST   /api/chat/sessions/:id/execute  → 执行 Agent 任务
GET    /api/chat/sessions/:id/tasks    → 获取任务列表
WS     /ws/chat                        → 实时消息推送
```

### 2.4 意图分类器

使用 LLM 做零样本分类：

```typescript
type Intent = 
  | 'create_project'      // 创建新项目
  | 'modify_code'         // 修改现有代码
  | 'code_review'         // 代码审查
  | 'run_tests'           // 运行测试
  | 'fix_bug'             // 修复 Bug
  | 'deploy'              // 部署
  | 'explain'             // 解释代码
  | 'chat'                // 普通聊天
```

分类 Prompt 模板：
```
分析用户输入的意图，从以下选项中选择最匹配的一个：
- create_project: 用户想要创建一个新的软件项目或功能
- modify_code: 用户想要修改、添加或删除代码
- code_review: 用户想要审查代码质量
- run_tests: 用户想要运行测试用例
- fix_bug: 用户想要修复一个错误
- deploy: 用户想要部署应用
- explain: 用户想要理解某段代码或概念
- chat: 普通聊天，不涉及具体开发任务

用户输入: {userInput}

请只返回意图标识符，不要解释。
```

### 2.5 执行流程

```
用户: "给 Dashboard 添加一个导出 Excel 的功能"

1. 意图识别 → modify_code
2. 上下文检查 → 当前项目 = AgentHive Web
3. 调用 Orchestrator → 生成 Tickets:
   - T-001: 后端 API - 添加 /api/dashboard/export (backend-dev)
   - T-002: 前端页面 - 添加导出按钮和下载逻辑 (frontend-dev)
   - T-003: 代码审查 (qa-engineer)
4. 并行执行 Workers
5. WebSocket 实时推送进度:
   - "阿铁正在编写导出 API..."
   - "小花正在添加前端按钮..."
   - "阿镜正在审查代码..."
6. 结果汇总:
   - "已完成！后端新增了 /api/dashboard/export 接口，前端添加了导出按钮。已通过 QA 审查。"
```

## 3. 与现有系统的集成

- **Orchestrator**: `AGENTS/orchestrator.ts` 已存在，Chat Controller 通过 child_process spawn 调用
- **Agent Runtime**: `apps/agent-runtime/` 已存在，通过 WebSocket 通信
- **Workspace**: `AGENTS/workspace/` 已存在，每个 Ticket 隔离执行
- **LLM**: 使用 `apps/api/src/services/llm.ts` 或本地 Ollama
