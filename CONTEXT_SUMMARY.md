# AgentHive Cloud - 上下文总结

**最后更新**: 2026-03-31  
**当前阶段**: Sprint 3 设计完成，等待编码  
**环境**: Windows + WSL2 + Docker Desktop + K8s

---

## 📌 项目定位

**AgentHive Cloud** - 云原生可视化AI团队协作平台

> 让AI研发团队管理像管理真实团队一样直观、可控、高效。用户通过Web界面可视化指挥AI Agent团队完成软件开发。

---

## 🏗️ 核心架构 (4层)

```
┌─────────────────────────────────────────────┐
│ Layer 4: Presentation 展示层                │
│ Vue3 + TypeScript + Vite                    │
│ - Agent Dashboard                           │
│ - Code Editor (Monaco)                      │
│ - Terminal (xterm.js)                       │
├─────────────────────────────────────────────┤
│ Layer 3: Control 控制层                     │
│ Go + Gin (Supervisor服务)                   │
│ - REST API Gateway                          │
│ - WebSocket Hub                             │
│ - Task Scheduler                            │
│ - State Manager                             │
├─────────────────────────────────────────────┤
│ Layer 2: Execution 执行层                   │
│ Kubernetes Agent Pods                       │
│ - Director (项目经理)                       │
│ - Backend Dev (后端开发)                    │
│ - Frontend Dev (前端开发)                   │
│ - [Scrum Master, Tech Lead, QA, DevOps]     │
├─────────────────────────────────────────────┤
│ Layer 1: Infrastructure 基础设施层          │
│ Redis (状态缓存)                            │
│ PostgreSQL (数据持久化)                     │
│ MinIO (文件存储)                            │
└─────────────────────────────────────────────┘
```

---

## 👥 Agent团队 (6+角色)

| 角色 | 职责 | 技术栈 |
|------|------|--------|
| **Director** | 团队协调、对外汇报 | 项目管理 |
| **Backend Dev** | API开发、数据库 | Go, Python |
| **Frontend Dev** | UI实现、交互 | Vue3, TS |
| **Scrum Master** | 流程管理、障碍清除 | 敏捷 |
| **Tech Lead** | 架构决策、代码审查 | 架构 |
| **QA Engineer** | 测试、质量把关 | 自动化测试 |
| **DevOps** | 部署、CI/CD | K8s, Helm |

---

## 📁 项目结构

```
agenthive-cloud/
├── apps/                          # 应用代码
│   ├── web/                       # Vue3 Web UI (未实现)
│   ├── supervisor/                # Go控制服务 (骨架)
│   └── agent-runtime/             # Agent运行时 (未实现)
│
├── deploy/                        # K8s部署
│   ├── helm/agenthive/            # Helm charts (配置)
│   └── skaffold.yaml              # 热重载开发
│
├── agents/                        # Agent配置
│   └── roles/                     # 角色定义YAML
│
├── docs/                          # 设计文档 ✅
│   ├── architecture/              # 架构设计
│   ├── design/                    # 数据库Schema
│   ├── api/                       # OpenAPI规范
│   ├── frontend/                  # 组件设计
│   └── deployment/                # K8s架构
│
├── sprint-runs/                   # Sprint记录
│   └── sprint-3/                  # 模拟完成记录
│
├── Makefile                       # 常用命令
├── README.md                      # 项目说明
├── DESIGN_COMPLETE_SUMMARY.md     # 设计总结
└── CONTEXT_SUMMARY.md             # 本文件
```

---

## 💾 数据模型

### PostgreSQL (持久化)

```sql
teams              -- 团队/租户
  - id, name, namespace, max_agents

agents             -- Agent实例
  - id, team_id, role, status, pod_name, config

tasks              -- 任务
  - id, agent_id, type, status, input, output, progress

code_snapshots     -- 代码快照
  - id, task_id, file_path, content

messages           -- 对话消息
  - id, sender_type, content, metadata
```

### Redis (实时)

```
agent:{id}                  -- Hash: Agent状态
task:queue:{team_id}        -- List: 任务队列
code:updates:{team_id}      -- Pub/Sub: 代码更新
ws:client:{client_id}       -- String: WebSocket连接
```

---

## 🔌 API设计

### REST API

```
GET    /api/v1/agents              # 列出Agent
POST   /api/v1/agents              # 创建Agent
GET    /api/v1/agents/:id          # Agent详情
POST   /api/v1/agents/:id/command  # 发送指令

GET    /api/v1/tasks               # 列出任务
POST   /api/v1/tasks               # 创建任务
GET    /api/v1/tasks/:id           # 任务详情
```

### WebSocket

```
Endpoint: wss://api.agenthive.io/ws

Events (Server → Client):
- agent_state       # Agent状态变更
- task_update       # 任务进度更新
- code_update       # 代码变更
- terminal_output   # 终端输出

Events (Client → Server):
- subscribe         # 订阅团队更新
- agent_command     # 发送Agent指令
```

---

## 🎨 前端组件

```
src/
├── components/
│   ├── agent/
│   │   ├── AgentCard.vue      # Agent卡片
│   │   ├── AgentPanel.vue     # 详情面板
│   │   └── AgentList.vue      # Agent列表
│   ├── code/
│   │   └── CodeEditor.vue     # Monaco编辑器
│   ├── terminal/
│   │   └── Terminal.vue       # xterm.js终端
│   └── chat/
│       └── ChatView.vue       # 对话视图
│
├── stores/
│   ├── agent.ts               # Agent状态(Pinia)
│   ├── task.ts                # 任务状态
│   └── ws.ts                  # WebSocket
│
└── api/
    └── websocket.ts           # WebSocket管理
```

---

## ☸️ K8s部署

### 资源配额

**开发环境**:

- Web UI: 100m/500m CPU, 128Mi/512Mi Memory
- Supervisor: 250m/1000m CPU, 256Mi/1Gi Memory
- Agent: 500m/2000m CPU, 512Mi/2Gi Memory × 3
- **总计**: 2.2核/9核 CPU, 2.2GB/8GB Memory

**生产环境**:

- 各组件副本数 ×3
- **总计**: 8.4核/30核 CPU, 9.4GB/28GB Memory

### 核心配置

```yaml
# Namespace
agenthive-dev / agenthive-prod

# Deployments
web-deployment (Vue3)
supervisor-deployment (Go)
agent-runtime (StatefulSet)

# Services
ClusterIP for internal
NodePort for local dev
Ingress for production

# Storage
PersistentVolumeClaim 10Gi per Agent
```

---

## 🗓️ 路线图 (12个月)

```
2026 Q2          2026 Q3          2026 Q4          2027 Q1
├────────────────┼────────────────┼────────────────┼──────────────┤
│ Sprint 3-4     │ Sprint 5-7     │ Sprint 8-10    │ Sprint 11-12 │
│ MVP            │ V1.0           │ V1.5           │ V2.0         │
│ 基础验证       │ 生产就绪       │ 智能增强       │ 平台生态     │
└────────────────┴────────────────┴────────────────┴──────────────┘
```

### 当前: Sprint 3 (设计完成)

**目标**: 云原生基础架构 + 3个核心Agent  
**任务**: S3-001~005 (26故事点)

### 下一步: Sprint 4

**目标**: 功能验证 + Demo准备  
**任务**: 完整演示登录功能开发

---

## 🚀 下一步行动 (待执行)

### Phase 1: 初始化 (Day 1)

- [ ] 创建Kind集群
- [ ] 初始化Supervisor Go项目
- [ ] 初始化Web Vue3项目
- [ ] 配置Helm Chart

### Phase 2: 核心实现 (Day 2-3)

- [ ] Supervisor API实现
- [ ] Agent Runtime框架
- [ ] WebSocket通信

### Phase 3: 可视化 (Day 4-5)

- [ ] Monaco Editor集成
- [ ] xterm.js终端
- [ ] Agent状态实时更新

### Phase 4: Demo (Day 6-7)

- [ ] 登录功能示例
- [ ] 端到端测试
- [ ] Demo脚本

---

## 📊 关键指标

| 指标 | 目标 | 当前 |
|------|------|------|
| 任务调度延迟 | <100ms | 设计中 |
| WebSocket延迟 | <200ms | 设计中 |
| 单节点Agent数 | >100 | 设计中 |
| Sprint 3完成 | 100% | 设计✅ 编码⏳ |

---

## ⚠️ 关键决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-03-31 | 使用K8s作为Agent运行时 | 隔离、自愈、水平扩展 |
| 2026-03-31 | WebSocket实时通信 | 低延迟、双向、可视化 |
| 2026-03-31 | Supervisor+Agent分离 | 职责分离、独立扩展 |
| 2026-03-31 | 设计先行，再编码 | 避免返工，确保架构正确 |

---

## 🔗 重要文件

```bash
# 查看本总结
cat CONTEXT_SUMMARY.md

# 查看设计总结
cat DESIGN_COMPLETE_SUMMARY.md

# 查看架构设计
cat docs/architecture/ARCHITECTURE_EXPLANATION.md

# 查看Sprint 3
cat docs/sprints/sprint-3/README.md

# 查看路线图
cat docs/roadmap/PRODUCT_ROADMAP.md
```

---

## 💡 关键记忆点

1. **不是简单的Chat应用** - 是可视化AI团队协作平台
2. **Agent是K8s Pod** - 不是本地进程，可水平扩展
3. **实时可视化** - WebSocket推送代码、终端、状态
4. **人机协作** - 人类可观察、干预、指导Agent
5. **设计已完成** - 可以开始编码了

---

**下一步**: 开始实际编码实现！🚀
