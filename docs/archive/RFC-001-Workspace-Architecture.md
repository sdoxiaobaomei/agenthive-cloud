# RFC-001: Workspace 架构设计研究

> **状态**: 🟡 待讨论 / 待实现  
> **类型**: 架构设计 / 基础设施  
> **负责人**: DevOps Agent (待分配)  
> **创建日期**: 2026-04-07  
> **相关模块**: landing, api, agent-runtime, 基础设施

---

## 📋 执行摘要

针对用户提出的 "landing 中的 workspace 架构问题"，本研究分析了业界主流方案，特别是 **Atoms.dev** 的架构设计，并提出了适合 AgentHive Cloud 的渐进式演进方案。

**核心结论**: 当前架构（多 Agent 共享本地目录）适合 MVP 阶段，但要达到 Atoms.dev 级别的用户体验，需要向 **"Project = 隔离容器"** 架构演进。

---

## 1. 背景与问题定义

### 1.1 当前架构

```
Frontend (Landing) ←→ API Server ←→ AGENTS/workspace/ (物理目录)
                                           ↑
                                    Agent 共享访问
```

**存在的问题**:
- ❌ Agent 间无隔离，可能互相干扰
- ❌ 文件同步复杂（需要 File Watcher + WebSocket）
- ❌ 扩展性差（磁盘 I/O 瓶颈）
- ❌ 并发编辑冲突难以处理

### 1.2 目标

实现类似 Atoms.dev 的体验：**每个 Project 一个完全隔离的云端开发环境**

---

## 2. Atoms.dev 架构分析

### 2.1 核心设计原则

基于使用体验观察和业界信息，Atoms 采用以下架构：

```
Project = Kubernetes Pod
├── VS Code Server (Web IDE)
├── Dev Server (Next.js/Vite)
└── Agent Runtime (Sidecar)
    ↓
共享 Volume (/workspace)
```

### 2.2 关键特点

| 特点 | 实现方式 | 优势 |
|------|----------|------|
| **文件实时同步** | 共享 Volume，无需网络同步 | 零延迟，Agent 修改立即可见 |
| **多 Agent 协作** | 同 Pod 内多 Container | 进程级通信，共享内存 |
| **前端纯渲染** | WebSocket 连接到 VS Code Server | 前端无状态，刷新不丢数据 |
| **持久化** | K8s PVC (AWS EFS/GCP Filestore) | Pod 重建数据不丢 |
| **隔离性** | 每个 Project 独立 Pod | 资源隔离，安全隔离 |

### 2.3 数据流分析

```
用户点击文件
    ↓
Frontend WebSocket
    ↓
VS Code Server (in Pod)
    ↓
读取 /workspace/file.tsx
    ↓
返回文件内容
    ↓
Monaco Editor 渲染

Agent 修改文件:
Agent Container → 写入 /workspace/file.tsx
                    ↓
              VS Code Server File Watcher
                    ↓
              WebSocket 推送变更
                    ↓
              Frontend 更新显示
```

---

## 3. 业界主流方案对比

### 3.1 方案对比表

| 方案 | 代表产品 | 隔离级别 | 复杂度 | 成本 | 适用场景 |
|------|----------|----------|--------|------|----------|
| **后端集中式** | 早期 Gitpod | 进程级 | 低 | 低 | MVP/小团队 |
| **微服务拆分** | GitHub Codespaces | 服务级 | 高 | 高 | 企业级 |
| **K8s Pod 隔离** | Atoms.dev, Gitpod | Pod 级 | 中 | 中 | 平衡选择 ⭐ |
| **纯前端容器** | StackBlitz | 浏览器级 | 低 | 极低 | 轻量演示 |
| **VM 隔离** | GitHub Codespaces | VM 级 | 高 | 很高 | 高安全需求 |

### 3.2 详细分析

#### 方案 A: 后端集中式（当前）

```
Frontend ←→ API Server ←→ 本地磁盘
```

- ✅ 简单快速
- ❌ 扩展性差，Agent 冲突

#### 方案 B: K8s Pod 隔离（推荐）

```
Frontend ←→ K8s Ingress ←→ Workspace Pod
                                    ├── VS Code Server
                                    ├── Agent Runtime
                                    └── Dev Server
```

- ✅ 良好隔离，中等成本
- ✅ 生态成熟（可用 code-server）
- ❌ 需要 K8s 基础设施

#### 方案 C: Serverless 容器

```
Frontend ←→ Cloud Run/App Runner ←→ 按需启动的 Container
```

- ✅ 按量付费，零空闲成本
- ❌ 冷启动慢（10-30s）

---

## 4. 建议架构: 渐进式演进

### 4.1 三阶段路线图

```
阶段 1 (现在): 本地 Docker 伪隔离
    ↓
阶段 2 (3个月内): 自托管 K8s 隔离
    ↓
阶段 3 (6个月内): 多云 Serverless
```

### 4.2 阶段 1: 本地 Docker 伪隔离

**目标**: 在不改变基础设施的前提下，实现基本的隔离

```yaml
# docker-compose.workspace.yml
version: '3.8'

services:
  workspace-{PROJECT_ID}:
    image: agenthive/workspace:latest
    container_name: workspace-{PROJECT_ID}
    volumes:
      - workspace-{PROJECT_ID}-data:/workspace
      # 只挂载该项目的 AGENTS/workspace/T-xxx
      - ./AGENTS/workspace/{PROJECT_ID}:/workspace/agent:rw
    ports:
      - "{DYNAMIC_PORT}:3000"  # VS Code Server
    environment:
      - PROJECT_ID={PROJECT_ID}
      - AGENT_API_KEY={API_KEY}
    networks:
      - workspace-network

  # 每个项目独立的 Agent Runtime
  agent-{PROJECT_ID}:
    image: agenthive/agent-runtime:latest
    container_name: agent-{PROJECT_ID}
    volumes:
      - ./AGENTS/workspace/{PROJECT_ID}:/workspace:rw
    environment:
      - WORKSPACE_PATH=/workspace
      - PROJECT_ID={PROJECT_ID}
    depends_on:
      - workspace-{PROJECT_ID}
```

**关键改进**:
1. 每个 Project 独立的 Docker Compose stack
2. 独立的 Volume，避免文件冲突
3. 动态端口分配，避免端口冲突

**待实现**:
- [ ] Workspace Manager 服务（管理容器生命周期）
- [ ] 动态端口分配算法
- [ ] 容器健康检查与自动重启

### 4.3 阶段 2: Kubernetes 隔离

**目标**: 生产级隔离，支持多用户并发

```yaml
# workspace-crd.yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: workspaces.agenthive.io
spec:
  group: agenthive.io
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                projectId:
                  type: string
                userId:
                  type: string
                template:
                  type: string
                  enum: ["nextjs", "vue", "vanilla"]
                resources:
                  type: object
                  properties:
                    cpu:
                      type: string
                      default: "1"
                    memory:
                      type: string
                      default: "2Gi"
                    storage:
                      type: string
                      default: "10Gi"
                runtime:
                  type: object
                  properties:
                    vscode:
                      type: boolean
                      default: true
                    agent:
                      type: boolean
                      default: true
                    preview:
                      type: boolean
                      default: true
```

**Workspace Pod 设计**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: workspace-{PROJECT_ID}
  labels:
    app: workspace
    project: {PROJECT_ID}
spec:
  initContainers:
    # 初始化：从 Git/S3 拉取代码
    - name: init-workspace
      image: agenthive/workspace-init:latest
      volumeMounts:
        - name: workspace
          mountPath: /workspace
      env:
        - name: GIT_REPO
          value: "{REPO_URL}"
        - name: PROJECT_TEMPLATE
          value: "{TEMPLATE}"
  
  containers:
    # 1. VS Code Server (Web IDE)
    - name: vscode
      image: codercom/code-server:latest
      ports:
        - containerPort: 8080
          name: vscode
      volumeMounts:
        - name: workspace
          mountPath: /home/coder/workspace
      resources:
        limits:
          cpu: "500m"
          memory: "1Gi"
    
    # 2. Dev Server (热更新)
    - name: dev-server
      image: agenthive/dev-server:latest
      ports:
        - containerPort: 3000
          name: dev
      volumeMounts:
        - name: workspace
          mountPath: /workspace
      env:
        - name: FRAMEWORK
          value: "{nextjs|vue|nuxt}"
    
    # 3. Agent Runtime (Sidecar)
    - name: agent
      image: agenthive/agent-runtime:latest
      volumeMounts:
        - name: workspace
          mountPath: /workspace
      env:
        - name: AGENT_MODE
          value: "sidecar"
        - name: PROJECT_ID
          value: "{PROJECT_ID}"
      resources:
        limits:
          cpu: "1000m"
          memory: "2Gi"
  
  volumes:
    - name: workspace
      persistentVolumeClaim:
        claimName: workspace-{PROJECT_ID}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: workspace-{PROJECT_ID}
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd  # 高性能 SSD
  resources:
    requests:
      storage: 10Gi
```

**待实现**:
- [ ] Workspace Operator (K8s Controller)
- [ ] 自定义 CRD 定义
- [ ] PVC 自动扩缩容
- [ ] Pod 自动休眠/唤醒（节省成本）

### 4.4 阶段 3: Serverless 优化

**目标**: 降低成本，零空闲费用

```
用户请求 Workspace
    ↓
Cloud Run / AWS App Runner
    ↓
冷启动 Container (10-30s)
    ↓
从 EFS/S3 恢复文件系统
    ↓
Workspace Ready
    ↓
空闲 10 分钟 → 自动停止
```

**待实现**:
- [ ] 快照/恢复机制（快速冷启动）
- [ ] 预热池（减少冷启动延迟）

---

## 5. 关键组件设计

### 5.1 Workspace Manager API

```typescript
// 核心接口定义
interface WorkspaceManager {
  // 创建 Workspace
  createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace>;
  
  // 获取连接信息（前端用）
  getConnectionInfo(workspaceId: string): Promise<ConnectionInfo>;
  
  // 停止/启动 Workspace
  stopWorkspace(workspaceId: string): Promise<void>;
  startWorkspace(workspaceId: string): Promise<void>;
  
  // 执行 Agent 任务
  executeTask(workspaceId: string, task: Task): Promise<TaskResult>;
  
  // 文件操作代理
  readFile(workspaceId: string, path: string): Promise<FileContent>;
  writeFile(workspaceId: string, path: string, content: string): Promise<void>;
}

interface ConnectionInfo {
  workspaceId: string;
  vscodeUrl: string;      // WebSocket URL for VS Code
  previewUrl: string;     // Dev Server 预览地址
  agentStatus: 'idle' | 'running' | 'error';
  expiresAt: Date;        // Session 过期时间
}
```

### 5.2 前端适配

```typescript
// composables/useWorkspace.ts (新)
export function useWorkspace(projectId: string) {
  const config = useRuntimeConfig();
  
  // 1. 获取 Workspace 连接信息
  const { data: connInfo } = await useFetch(
    `/api/workspaces/${projectId}/connect`
  );
  
  // 2. 连接到 VS Code Server
  const vscodeWs = new WebSocket(connInfo.value.vscodeUrl);
  
  // 3. 初始化 Monaco Editor Remote Mode
  const editor = monaco.editor.create(element, {
    model: null, // 远程 model
  });
  
  // 4. 设置文件同步
  const fileSync = new FileSyncProvider(vscodeWs, editor);
  
  return {
    editor,
    fileSync,
    previewUrl: connInfo.value.previewUrl,
  };
}
```

### 5.3 Agent Runtime 改造

```typescript
// agent-runtime/src/services/workspace-client.ts

export class WorkspaceClient {
  private workspacePath: string;
  
  constructor() {
    // 从环境变量获取挂载路径
    this.workspacePath = process.env.WORKSPACE_PATH || '/workspace';
  }
  
  // 直接操作文件（无需 HTTP API）
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.workspacePath, relativePath);
    return fs.readFile(fullPath, 'utf-8');
  }
  
  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.workspacePath, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    
    // 触发文件变更事件（通过共享内存或信号）
    this.notifyChange(relativePath);
  }
  
  // 监听外部变更（VS Code 用户编辑）
  watchFiles(pattern: string, callback: (path: string) => void): void {
    const watcher = chokidar.watch(
      path.join(this.workspacePath, pattern),
      { ignoreInitial: true }
    );
    watcher.on('change', callback);
  }
}
```

---

## 6. 基础设施需求

### 6.1 阶段 1 (Docker)

- [ ] Docker Compose 动态生成器
- [ ] Nginx 反向代理（动态路由到不同端口）
- [ ] 端口池管理（避免冲突）

### 6.2 阶段 2 (K8s)

- [ ] Kubernetes 集群（推荐 managed: EKS/GKE/AKS）
- [ ] Container Registry（存储 Workspace 镜像）
- [ ] 存储类：
  - AWS: EFS (ReadWriteMany) 或 EBS (ReadWriteOnce)
  - GCP: Filestore
  - 自托管: NFS / Longhorn
- [ ] Ingress Controller: NGINX / Traefik
- [ ] 证书管理: cert-manager

### 6.3 网络架构

```
Internet
    ↓
Cloudflare / CDN
    ↓
K8s Ingress (HTTPS)
    ↓
┌─────────────────────────────────────┐
│  Namespace: workspaces              │
│                                     │
│  ┌─────────┐     ┌──────────────┐   │
│  │ Ingress │────►│ Workspace    │   │
│  │ Rule    │     │ Pod (VS Code)│   │
│  │ /ws-001 │     └──────────────┘   │
│  └─────────┘                        │
│       │                             │
│  ┌────┴────┐     ┌──────────────┐   │
│  │ Ingress │────►│ Workspace    │   │
│  │ /ws-002 │     │ Pod (VS Code)│   │
│  └─────────┘     └──────────────┘   │
└─────────────────────────────────────┘
```

---

## 7. 成本估算

### 7.1 阶段 1: Docker (自托管)

| 资源 | 规格 | 月成本 |
|------|------|--------|
| 服务器 | 4c8g × 2 | ¥600-800 |
| 存储 | 100GB SSD | ¥100 |
| **总计** | | **¥700-900/月** |

### 7.2 阶段 2: K8s (AWS EKS 示例)

| 资源 | 规格 | 月成本 |
|------|------|--------|
| EKS 控制平面 | - | $72 |
| Worker 节点 | t3.large × 3 | $135 |
| EBS 存储 | 100GB × 3 | $30 |
| 网络 (LB) | ALB + NLB | $50 |
| **总计** | | **~$287/月 (~¥2000)** |

### 7.3 优化后 (自动扩缩容)

| 场景 | 成本 |
|------|------|
| 空闲 (0 Workspace) | $72 (仅 EKS) |
| 正常 (10 Workspace) | $150/月 |
| 高峰 (50 Workspace) | $500/月 |

---

## 8. 风险评估与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| K8s 复杂性 | 高 | 阶段 1 先验证概念，使用 managed K8s |
| 冷启动延迟 | 中 | 预热池 + 快照恢复 |
| 存储成本 | 中 | 自动休眠，释放不活跃 Workspace |
| 数据丢失 | 高 | 定期快照到 S3，多可用区存储 |
| 安全隔离 | 高 | NetworkPolicy，非 root 容器，资源限制 |

---

## 9. 待讨论/决策事项

### 🔴 高优先级（阻塞开发）

- [ ] **决策 1**: 是否采用 K8s？还是保持 Docker Compose？
  - 影响: 技术栈选择，团队技能要求
  - 建议: 先 Docker 验证，3 个月后迁移 K8s

- [ ] **决策 2**: 存储方案选择？
  - 选项 A: EFS (AWS) - 贵但简单
  - 选项 B: EBS + 自定义同步 - 便宜但复杂
  - 选项 C: S3 + 本地缓存 - 成本最低

- [ ] **决策 3**: 是否使用现成的 code-server？
  - 选项 A: coder/code-server (开源，成熟)
  - 选项 B: 自研编辑器 (灵活，工作量大)

### 🟡 中优先级（影响设计）

- [ ] **决策 4**: Workspace 生命周期管理策略？
  - 空闲多久自动停止？
  - 自动删除策略？

- [ ] **决策 5**: Agent 与 Workspace 的通信方式？
  - 选项 A: 共享 Volume (文件)
  - 选项 B: gRPC/HTTP API
  - 选项 C: 消息队列 (Redis/RabbitMQ)

### 🟢 低优先级（可延后）

- [ ] **决策 6**: 是否支持多用户同时编辑？
  - 需要 CRDT (Yjs) 实现

---

## 10. 下一步行动

### 给 DevOps Agent 的任务

1. **基础设施评估** (2-3 天)
   - 评估当前服务器是否支持 Docker Compose 方案
   - 调研 K8s managed 服务成本 (EKS vs GKE vs AKS)

2. **POC 实现** (1 周)
   - 创建最小可工作的 Workspace Docker 镜像
   - 集成 code-server + Agent Runtime
   - 验证文件共享机制

3. **网络架构设计** (2-3 天)
   - 设计 Ingress 规则（动态子域名 vs 路径路由）
   - SSL 证书自动化方案

### 给 Backend Agent 的任务

1. **Workspace Manager API** (3-5 天)
   - 设计 REST API + WebSocket 协议
   - 实现容器生命周期管理

2. **Agent Runtime 改造** (2-3 天)
   - 支持 Workspace 模式（直接文件操作）
   - 向后兼容现有 API 模式

### 给 Frontend Agent 的任务

1. **远程编辑器集成** (3-5 天)
   - 集成 code-server Web 组件
   - 或实现 Monaco Remote Mode

---

## 11. 参考资料

- [Coder/code-server](https://github.com/coder/code-server) - VS Code in browser
- [Kubernetes Operator Pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Atoms.dev](https://atoms.dev) - 产品体验参考

---

## 附录: 术语表

| 术语 | 解释 |
|------|------|
| **Workspace** | 隔离的开发环境，包含代码、运行时、Agent |
| **CRD** | Custom Resource Definition, K8s 自定义资源 |
| **PVC** | Persistent Volume Claim, K8s 存储声明 |
| **Sidecar** | 与主容器共享资源但独立的辅助容器 |
| **CRDT** | Conflict-free Replicated Data Types, 无冲突复制数据类型 |

---

**文档结束**  
**待 DevOps Agent 审核与反馈**
