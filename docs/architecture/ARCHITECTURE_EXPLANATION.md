# AgentHive Cloud 架构设计详解

**主讲**: Tech Lead Agent (架构师)  
**日期**: 2026-03-31  
**版本**: v1.0

---

## 1. 架构设计哲学

### 1.1 核心思想

> **"把AI Agent当作真实的研发团队成员来管理"**

这意味着：
- 每个Agent有自己的**身份**、**技能**、**状态**
- Agent之间需要**协作**、**通信**、**协调**
- 人类管理者可以**观察**、**干预**、**指导**
- 整个团队运行在**云原生**基础设施上

### 1.2 设计原则

| 原则 | 说明 | 实现 |
|------|------|------|
| **可视化** | 白盒而非黑盒 | WebSocket实时推送Agent状态 |
| **可干预** | 人类随时介入 | 命令通道 + 暂停/恢复机制 |
| **可扩展** | 按需增加Agent | K8s Pod水平扩展 |
| **容错性** | 单点故障不影响整体 | 状态持久化 + 故障转移 |

---

## 2. 整体架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Presentation (展示层)                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Web UI (Vue3 SPA)                                  │   │
│  │  - Agent Dashboard                                  │   │
│  │  - Code Editor (Monaco)                             │   │
│  │  - Terminal (xterm.js)                              │   │
│  │  - Chat Interface                                   │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Control (控制层)                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Agent Supervisor (Go)                              │   │
│  │  - REST API Gateway                                 │   │
│  │  - WebSocket Hub                                    │   │
│  │  - Task Scheduler                                   │   │
│  │  - State Manager                                    │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Execution (执行层)                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │Agent │ │Agent │ │Agent │ │Agent │ │Agent │ │Agent │   │
│  │Pod 1 │ │Pod 2 │ │Pod 3 │ │Pod 4 │ │Pod 5 │ │Pod N │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│  - Director    - Backend     - Frontend   - QA           │
│  - Tech Lead   - DevOps      - [Custom]   - [Custom]     │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Infrastructure (基础设施层)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │  Redis  │ │PostgreSQL│ │  MinIO  │ │  LLM    │        │
│  │ (State) │ │ (Data)   │ │(Storage)│ │(Ollama) │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 部署视图

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Namespace: agenthive                                  │  │
│  │                                                       │  │
│  │  ┌──────────────┐    ┌──────────────┐               │  │
│  │  │   Ingress    │    │   Ingress    │               │  │
│  │  │   (Web)      │    │   (API)      │               │  │
│  │  └──────┬───────┘    └──────┬───────┘               │  │
│  │         │                   │                       │  │
│  │  ┌──────▼───────┐    ┌──────▼───────┐               │  │
│  │  │  Web Pods    │    │ Supervisor   │               │  │
│  │  │  (Vue3)      │    │  Service     │               │  │
│  │  │  Replica: 2  │    │  Replica: 2  │               │  │
│  │  └──────────────┘    └──────┬───────┘               │  │
│  │                             │                       │  │
│  │                    ┌────────▼────────┐              │  │
│  │                    │   Agent Pods    │              │  │
│  │                    │  (StatefulSet)  │              │  │
│  │                    │                 │              │  │
│  │                    │  ┌───┐┌───┐    │              │  │
│  │                    │  │A1 ││A2 │... │              │  │
│  │                    │  └───┘└───┘    │              │  │
│  │                    └─────────────────┘              │  │
│  │                             │                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │  │
│  │  │  Redis   │ │ Postgres │ │  MinIO   │           │  │
│  │  │  Cluster │ │  Primary │ │  Cluster │           │  │
│  │  └──────────┘ └──────────┘ └──────────┘           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心组件详解

### 3.1 Agent Supervisor (控制中心)

**职责**: 整个Agent团队的"项目经理"

**核心模块**:

```go
// 1. API Gateway - 对外接口
type APIGateway struct {
    // REST API for CRUD operations
    // WebSocket for real-time updates
}

// 2. Task Scheduler - 任务调度器
type Scheduler struct {
    queue chan Task          // 任务队列
    agents map[string]Agent  // 注册的Agent
    
    // 调度算法：轮询、负载均衡、能力匹配
    dispatch(task Task) error
}

// 3. State Manager - 状态管理
type StateManager struct {
    redis *Redis.Client      // 状态缓存
    
    // Agent状态机
    transition(agentID string, from, to State) error
}

// 4. WebSocket Hub - 实时通信
type Hub struct {
    clients map[string]*Client     // Web UI连接
    agents map[string]*AgentConn   // Agent连接
    
    broadcast(event Event)         // 广播事件
}
```

**为什么用Go**:
- 高并发性能好 (goroutines)
- 内存占用低
- 静态类型，大型项目易维护
- K8s生态原生支持

---

### 3.2 Agent Runtime (执行引擎)

**职责**: 每个Agent的"大脑和手脚"

**生命周期**:

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│  Idle   │───▶│ Starting │───▶│ Working │───▶│ Completed│
└────┬────┘    └──────────┘    └────┬────┘    └──────────┘
     │                              │
     │                              │ (error)
     │                              ▼
     │                         ┌─────────┐
     └────────────────────────▶│  Error  │
                               └────┬────┘
                                    │ (retry)
                                    └─────────────▶
```

**核心能力**:

```go
type AgentRuntime struct {
    // 1. 与Supervisor通信
    supervisorClient *SupervisorClient
    
    // 2. 任务执行器
    executor *TaskExecutor
    
    // 3. LLM客户端
    llmClient *LLMClient
    
    // 4. 工具集
    tools ToolSet  // Git, File, Command, etc.
}

// 执行一个任务
func (a *AgentRuntime) Execute(task Task) Result {
    // 1. 解析任务
    // 2. 调用LLM制定计划
    // 3. 逐步执行
    // 4. 上报进度
    // 5. 返回结果
}
```

**为什么用容器**:
- 环境隔离 (不同Agent可能需要不同工具)
- 资源限制 (CPU/内存配额)
- 故障隔离 (一个Agent崩溃不影响其他)
- 水平扩展 (K8s自动调度)

---

### 3.3 Web UI (可视化层)

**职责**: 人类管理者的"监控大屏"

**组件架构**:

```
Web UI
├── Core
│   ├── App.vue                 # 主应用
│   ├── router/                 # 路由
│   └── stores/                 # Pinia状态
│       ├── agent.ts           # Agent状态
│       ├── task.ts            # 任务状态
│       └── ws.ts              # WebSocket
│
├── Views
│   ├── Dashboard.vue          # 主仪表板
│   ├── AgentDetail.vue        # Agent详情
│   ├── CodeViewer.vue         # 代码查看
│   └── SprintBoard.vue        # Sprint看板
│
└── Components
    ├── AgentCard.vue          # Agent卡片
    ├── CodeEditor.vue         # Monaco封装
    ├── Terminal.vue           # xterm.js封装
    └── ChatPanel.vue          # 对话面板
```

**实时通信**:

```typescript
// WebSocket连接管理
class WebSocketManager {
    socket: Socket;
    
    connect() {
        this.socket = io('/ws');
        
        // 监听Agent状态变更
        this.socket.on('agent_state', (data) => {
            useAgentStore().updateAgent(data);
        });
        
        // 监听代码更新
        this.socket.on('code_update', (data) => {
            useCodeStore().updateFile(data.file, data.content);
        });
        
        // 监听终端输出
        this.socket.on('terminal_output', (data) => {
            useTerminalStore().append(data.agentId, data.output);
        });
    }
}
```

---

## 4. 数据流

### 4.1 任务执行流

```
1. 用户提交任务
   │
   ▼
2. Supervisor接收 → 存入Redis队列
   │
   ▼
3. Scheduler选择合适Agent
   │
   ▼
4. Agent Pod拉取任务
   │
   ▼
5. Agent执行 (调用LLM + 工具)
   │
   ▼
6. 实时上报进度 (WebSocket)
   │
   ▼
7. Web UI更新显示
   │
   ▼
8. 任务完成，状态持久化到PostgreSQL
```

### 4.2 实时通信流

```
Agent Pod ──WebSocket──▶ Supervisor
                              │
                              ├──▶ Web UI (Dashboard)
                              ├──▶ Web UI (Code Editor)
                              └──▶ Web UI (Terminal)

延迟目标: < 200ms
```

---

## 5. 技术选型理由

### 5.1 为什么选K8s？

| 需求 | K8s解决方案 |
|------|-------------|
| Agent水平扩展 | Deployment/StatefulSet + HPA |
| 资源隔离 | Namespace + ResourceQuota |
| 故障恢复 | Pod自动重启、健康检查 |
| 配置管理 | ConfigMap + Secret |
| 服务发现 | Service + DNS |

### 5.2 为什么选Go + Vue3？

| 组件 | 技术 | 理由 |
|------|------|------|
| Supervisor | Go | 高并发、低延迟、K8s原生 |
| Agent Runtime | Go | 静态类型、易于容器化 |
| Web UI | Vue3 | 响应式、组件化、TypeScript支持 |
| 实时通信 | WebSocket | 双向、低延迟、标准协议 |
| 状态存储 | Redis | 高性能、Pub/Sub、TTL |
| 持久存储 | PostgreSQL | ACID、JSON支持、可靠 |

### 5.3 为什么选Monaco + xterm.js？

- **Monaco Editor**: VSCode同款，支持语法高亮、IntelliSense
- **xterm.js**: 标准终端模拟，支持ANSI颜色、光标控制
- 两者都是行业标准，文档丰富，社区活跃

---

## 6. 扩展性设计

### 6.1 水平扩展

```yaml
# Agent Pod HPA配置
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-backend-dev
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-backend-dev
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: agenthive_task_queue_depth
      target:
        type: AverageValue
        averageValue: "5"
```

### 6.2 新增Agent角色

只需三步：
1. 创建 `agents/roles/new-role.yaml` 配置
2. 实现 `apps/agent-runtime/roles/new-role/` 逻辑
3. 更新 Helm values 添加Deployment

```yaml
# 新角色配置示例
apiVersion: agenthive.io/v1
kind: AgentRole
metadata:
  name: security-engineer
spec:
  capabilities:
    - security-audit
    - vulnerability-scan
  resources:
    limits:
      memory: "4Gi"  # 需要更多内存运行扫描工具
```

---

## 7. 安全设计

### 7.1 网络安全

```
Internet
   │
   ▼ (HTTPS)
Ingress Controller
   │
   ├─▶ Web UI (静态资源)
   └─▶ API Gateway (认证)
           │
           ├─▶ Supervisor (RBAC)
           │       │
           │       └─▶ Agent Pods (mTLS)
           │
           └─▶ Internal Services (Redis, Postgres)
```

### 7.2 权限控制

| 角色 | 权限 |
|------|------|
| Human Admin | 完整权限，可删除Agent |
| Human User | 可查看、发送指令 |
| Director Agent | 可调度任务、创建Agent |
| Worker Agent | 仅执行分配的任务 |

### 7.3 沙箱隔离

```yaml
# Agent Pod安全配置
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
```

---

## 8. 故障处理

### 8.1 Agent崩溃

```
Agent Pod崩溃
   │
   ▼
K8s自动重启Pod
   │
   ▼
Agent从Redis恢复状态
   │
   ▼
继续执行未完成任务
```

### 8.2 Supervisor故障

```
Supervisor Pod崩溃
   │
   ▼
K8s启动新实例
   │
   ▼
从Redis恢复Agent注册表
   │
   ▼
WebSocket客户端自动重连
```

---

## 9. 性能指标

| 指标 | 目标 | 实现 |
|------|------|------|
| 任务调度延迟 | < 100ms | Go channel + Redis |
| WebSocket延迟 | < 200ms | 长连接 + 二进制协议 |
| 代码同步延迟 | < 500ms | 增量更新 |
| 单Supervisor支持Agent数 | > 100 | 水平扩展 |
| Agent启动时间 | < 10s | 镜像优化 + 预热 |

---

## 10. 演进路线

### Phase 1: MVP (当前)
- 基础3个Agent
- 单机K8s
- 本地LLM

### Phase 2: 生产级
- 10个Agent角色
- 多集群联邦
- 混合云部署

### Phase 3: 智能化
- Agent自我学习
- 自动扩缩容
- 预测性调度

### Phase 4: 平台化
- 第三方Agent市场
- 自定义Agent SDK
- 多租户SaaS

---

## 11. 总结

AgentHive架构的核心是：

> **"云原生 + 实时可视化 + 可干预的AI团队协作"**

通过：
1. **K8s** 提供弹性基础设施
2. **Supervisor** 集中管理和调度
3. **Agent Pods** 分布式执行任务
4. **Web UI** 实时可视化一切

实现了让AI Agent像真实团队一样工作，而人类管理者可以像管理真实团队一样管理AI。

---

**架构师**: Tech Lead Agent  
**审核状态**: ✅ Approved  
**下一步**: 开始Sprint 4 - 功能验证

有任何架构问题，欢迎继续讨论！
