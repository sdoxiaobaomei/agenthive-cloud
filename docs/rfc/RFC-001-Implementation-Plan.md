# RFC-001-Appendix: Atoms.dev 架构实施计划

> **文档类型**: 实施计划 / 工作量估算  
> **状态**: 🟡 待评审  
> **目标**: 详细列出靠近 Atoms.dev 架构所需的具体 Efforts

---

## 📊 总体概览

### Atoms.dev 核心能力拆解

| 能力 | 描述 | 复杂度 |
|------|------|--------|
| **云端 IDE** | 浏览器内 VS Code 体验 | ⭐⭐⭐⭐⭐ |
| **实时预览** | 代码修改即时看到效果 | ⭐⭐⭐⭐ |
| **Agent 协作** | AI 在后台修改代码，用户实时可见 | ⭐⭐⭐⭐⭐ |
| **项目隔离** | 每个 Project 独立环境 | ⭐⭐⭐⭐ |
| **一键部署** | 直接部署到 Vercel/Netlify | ⭐⭐⭐ |
| **多模型竞速** | Race Mode，多 Agent 并行 | ⭐⭐⭐⭐ |

### 当前差距分析

```
AgentHive Cloud          Atoms.dev
─────────────────        ─────────────────
❌ 本地磁盘存储     →     ✅ 云端隔离 Volume
❌ 文件 API 同步    →     ✅ 共享文件系统
❌ 简单文本编辑器   →     ✅ 完整 VS Code Web
❌ 手动部署         →     ✅ 自动部署
❌ 单 Agent 串行    →     ✅ 多 Agent 并行
```

---

## 🗓️ 实施路线图（6 个月）

### Phase 1: 基础设施搭建（Week 1-4）
**目标**: 建立 K8s 集群和基础组件

#### Week 1-2: Kubernetes 集群
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 选择 K8s 方案 | DevOps | 2d | 决策文档 |
| 创建集群 (EKS/GKE) | DevOps | 3d | 可访问的集群 |
| 配置存储类 (StorageClass) | DevOps | 2d | EFS/EBS 动态供给 |
| 部署 Ingress Controller | DevOps | 2d | 可路由的入口 |
| 部署 cert-manager | DevOps | 1d | 自动 HTTPS |

**决策点**:
- AWS EKS vs GCP GKE vs 阿里云 ACK
- EFS (共享存储) vs EBS (独立存储)

#### Week 3-4: Workspace 基础镜像
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 创建 workspace-base 镜像 | DevOps | 3d | Dockerfile + CI/CD |
| 集成 code-server | DevOps | 2d | 可运行的 VS Code Server |
| 集成 Dev Server (Next.js/Vite) | DevOps | 2d | 热更新服务 |
| 创建 Agent Runtime Sidecar 镜像 | DevOps | 3d | 可注入的 Agent 容器 |
| 镜像安全扫描 | DevOps | 2d | 无高危漏洞 |

**技术选型**:
```dockerfile
# workspace-base/Dockerfile
FROM ubuntu:22.04

# 1. 基础工具
RUN apt-get update && apt-get install -y \
    curl git nodejs npm python3 \
    && rm -rf /var/lib/apt/lists/*

# 2. 安装 code-server
RUN curl -fsSL https://code-server.dev/install.sh | sh

# 3. 安装开发框架
RUN npm install -g nuxt@latest vite@latest next@latest

# 4. 安装 Agent Runtime 依赖
COPY agent-runtime /opt/agent-runtime
RUN cd /opt/agent-runtime && npm install

# 5. 启动脚本
COPY start.sh /start.sh
CMD ["/start.sh"]
```

---

### Phase 2: Workspace 核心服务（Week 5-8）
**目标**: 实现 Workspace 生命周期管理

#### Week 5-6: Workspace Controller
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 设计 Workspace CRD | Backend | 3d | YAML Schema |
| 开发 Workspace Operator | Backend | 5d | K8s Controller |
| 实现 Pod 创建/销毁逻辑 | Backend | 3d | 生命周期管理 |
| 实现 PVC 动态管理 | Backend | 2d | 存储自动供给 |
| 集成 Ingress 动态路由 | Backend | 3d | 子域名分配 |

**核心代码量估算**:
```
workspace-operator/
├── src/
│   ├── controller.ts          # 400 lines
│   ├── reconciler.ts          # 600 lines
│   ├── resources/
│   │   ├── pod.ts             # 300 lines
│   │   ├── pvc.ts             # 200 lines
│   │   ├── ingress.ts         # 250 lines
│   │   └── service.ts         # 150 lines
│   └── utils/
│       ├── k8s-client.ts      # 200 lines
│       └── logger.ts          # 100 lines
└── tests/
    └── reconciler.test.ts     # 400 lines

总计: ~2,600 lines TypeScript
```

#### Week 7-8: Workspace Manager API
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 设计 REST API | Backend | 2d | OpenAPI Spec |
| 实现 Workspace CRUD API | Backend | 4d | HTTP Endpoints |
| 实现 WebSocket 代理 | Backend | 4d | 连接转发到 Pod |
| 实现状态监控 API | Backend | 3d | 健康检查/指标 |
| API 测试覆盖 | Backend | 3d | >80% 覆盖率 |

**API 设计**:
```typescript
// POST /api/workspaces
interface CreateWorkspaceRequest {
  projectId: string;
  template: 'nextjs' | 'vue' | 'nuxt' | 'vanilla';
  resources?: {
    cpu: string;      // "1" = 1 core
    memory: string;   // "2Gi"
    storage: string;  // "10Gi"
  };
}

// GET /api/workspaces/:id/connect
interface ConnectionInfo {
  workspaceId: string;
  status: 'pending' | 'running' | 'stopped' | 'error';
  urls: {
    vscode: string;    // wss://ws.agenthive.io/ws-xxx
    preview: string;   // https://preview-xxx.agenthive.io
    terminal: string;  // wss://term-xxx.agenthive.io
  };
  resources: {
    cpu: { used: number; total: number };
    memory: { used: number; total: number };
  };
  expiresAt: string;
}
```

---

### Phase 3: 前端集成（Week 9-12）
**目标**: 改造 Landing，支持远程 Workspace

#### Week 9-10: 远程编辑器集成
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 调研 code-server Web 集成 | Frontend | 2d | 技术方案文档 |
| 创建 Workspace 连接组件 | Frontend | 4d | Vue Component |
| 实现 WebSocket 连接管理 | Frontend | 3d | 连接状态管理 |
| 改造 FileTree 组件（远程模式）| Frontend | 4d | 支持远程文件树 |
| 实现文件操作（CRUD）| Frontend | 3d | 增删改查功能 |

**组件设计**:
```vue
<!-- components/WorkspaceEditor.vue -->
<template>
  <div class="workspace-editor">
    <!-- 连接状态指示器 -->
    <ConnectionStatus :status="connectionStatus" />
    
    <!-- 文件树 -->
    <RemoteFileTree 
      :workspaceId="workspaceId"
      @select="openFile"
    />
    
    <!-- 编辑器区域 -->
    <div class="editor-area">
      <MonacoRemoteEditor
        v-if="activeFile"
        :workspaceId="workspaceId"
        :filePath="activeFile.path"
        :websocketUrl="vscodeUrl"
      />
      <EmptyState v-else />
    </div>
    
    <!-- 终端 -->
    <XtermTerminal
      v-if="showTerminal"
      :workspaceId="workspaceId"
    />
  </div>
</template>
```

#### Week 11-12: 预览与协作
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 集成 iframe 预览 | Frontend | 3d | 热更新预览 |
| 实现端口转发 | Backend | 3d | 内网穿透 |
| 文件变更实时同步 | Frontend | 4d | WebSocket 推送 |
| 冲突处理 UI | Frontend | 3d | 合并冲突界面 |
| 移动端适配 | Frontend | 3d | 响应式设计 |

---

### Phase 4: Agent 集成（Week 13-16）
**目标**: Agent 直接操作 Workspace

#### Week 13-14: Agent Runtime 改造
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 添加 Workspace 模式 | Backend | 4d | 直接文件操作 |
| 实现 File Watcher | Backend | 3d | 监听文件变更 |
| 添加变更事件推送 | Backend | 3d | WebSocket 推送 |
| 支持并发 Agent | Backend | 4d | 多 Agent 协调 |
| 权限控制（文件访问）| Backend | 3d | 安全隔离 |

**架构变更**:
```typescript
// agent-runtime/src/modes/workspace-mode.ts

export class WorkspaceMode implements ExecutionMode {
  private workspacePath: string;
  private fileWatcher: chokidar.FSWatcher;
  private eventBus: EventEmitter;
  
  async init(config: WorkspaceConfig): Promise<void> {
    this.workspacePath = config.path;
    
    // 监听文件变更，推送到前端
    this.fileWatcher = chokidar.watch(this.workspacePath, {
      ignored: /node_modules|\.git/
    });
    
    this.fileWatcher.on('change', (path) => {
      this.eventBus.emit('file:changed', {
        path: relative(this.workspacePath, path),
        timestamp: Date.now()
      });
    });
  }
  
  // Agent 直接操作文件（无需 HTTP API）
  async executeTask(task: Task): Promise<TaskResult> {
    // 直接读写 /workspace 目录
    const result = await this.agent.execute(task, {
      workingDir: this.workspacePath,
      fileOperations: new LocalFileOperations(this.workspacePath)
    });
    
    return result;
  }
}
```

#### Week 15-16: 协作与竞速模式
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 实现 Race Mode | Backend | 5d | 多 Agent 并行 |
| 结果对比与合并 | Backend | 4d | 智能合并算法 |
| Agent 选择 UI | Frontend | 3d | 竞速结果展示 |
| 性能优化 | Backend | 3d | 资源调度优化 |

---

### Phase 5: 部署与运维（Week 17-20）
**目标**: 生产就绪，自动扩缩容

#### Week 17-18: 自动化部署
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| GitOps 工作流 | DevOps | 4d | ArgoCD 配置 |
| 镜像自动化构建 | DevOps | 3d | CI/CD Pipeline |
| 多环境管理 | DevOps | 3d | dev/staging/prod |
| 数据库迁移 | DevOps | 2d | Schema 管理 |

#### Week 19-20: 监控与优化
| 任务 | 负责人 | Effort | 产出 |
|------|--------|--------|------|
| 部署 Prometheus + Grafana | DevOps | 3d | 监控大盘 |
| 配置告警规则 | DevOps | 2d | 关键指标告警 |
| 实现自动扩缩容 | DevOps | 4d | HPA/VPA |
| 成本优化 | DevOps | 3d | 空闲资源回收 |
| 性能压测 | DevOps | 3d | 容量规划 |

---

## 📈 工作量汇总

### 按角色统计

| 角色 | 总人天 | 主要工作 |
|------|--------|----------|
| **DevOps** | 45d | K8s 集群、镜像、CI/CD、监控 |
| **Backend** | 50d | Controller、API、Agent 改造 |
| **Frontend** | 40d | 远程编辑器、预览、协作 UI |
| **总计** | **135d** | **约 6.5 人月** |

### 按 Phase 统计

```
Phase 1 (Week 1-4):   20人天  ████░░░░░░  基础设施
Phase 2 (Week 5-8):   30人天  ██████░░░░  核心服务
Phase 3 (Week 9-12):  35人天  ███████░░░  前端集成
Phase 4 (Week 13-16): 30人天  ██████░░░░  Agent 集成
Phase 5 (Week 17-20): 20人天  ████░░░░░░  部署运维
────────────────────────────────────────
总计:                135人天
```

### 代码量估算

| 模块 | 代码行数 | 语言 |
|------|----------|------|
| Workspace Operator | ~3,000 | TypeScript |
| Workspace Manager API | ~4,000 | TypeScript |
| 前端组件改造 | ~5,000 | Vue/TypeScript |
| Agent Runtime 改造 | ~3,000 | TypeScript |
| Dockerfile/配置 | ~1,000 | YAML/Dockerfile |
| **总计** | **~16,000** | - |

---

## 💰 成本估算（月度）

### 基础设施成本

| 资源 | 规格 | 单价 | 数量 | 月成本 |
|------|------|------|------|--------|
| EKS 控制平面 | - | $72 | 1 | $72 |
| Worker 节点 | t3.xlarge | $140 | 3 | $420 |
| EFS 存储 | 100GB | $30 | 1 | $30 |
| ALB (负载均衡) | - | $25 | 2 | $50 |
| 数据传输 | - | - | - | $50 |
| **基础成本** | | | | **$622** |

### 可变成本（按使用量）

| 场景 | Workspace 数 | 额外成本 | 总成本 |
|------|--------------|----------|--------|
| 空闲 | 0 | $0 | $622 |
| 轻量 | 10 | $100 | $722 |
| 正常 | 50 | $500 | $1,122 |
| 高峰 | 200 | $2,000 | $2,622 |

### 优化后成本（自动休眠）

```
假设：
- 100 个 Project
- 平均每天活跃 20 个
- 每个活跃 4 小时

计算：
- 基础成本: $622
- 活跃成本: 20 × $2 × 30 = $1,200
- 总计: ~$1,822/月
```

---

## ⚠️ 风险与缓解

### 高风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| K8s 学习曲线陡峭 | 高 | 延期 2-4 周 | 使用 managed K8s，购买培训 |
| code-server 定制困难 | 中 | 功能受限 | 提前做 POC，评估替代方案 |
| 文件同步性能问题 | 中 | 体验差 | 使用 EFS 而非网络同步 |
| 成本超支 | 中 | 项目砍减 | 严格监控，设置预算告警 |

### 技术债务

| 债务 | 描述 | 解决时机 |
|------|------|----------|
| 临时 Docker 方案 | Phase 1 的过渡方案 | Phase 2 必须迁移 |
| 单点故障 | 无高可用设计 | Phase 5 解决 |
| 安全隔离不完善 | NetworkPolicy 缺失 | Phase 2 补充 |

---

## 🎯 里程碑与验收标准

### Milestone 1: 基础设施就绪（Week 4）
✅ **标准**:
- [ ] K8s 集群可访问
- [ ] Workspace 基础镜像可运行
- [ ] 能手动创建 Workspace Pod

### Milestone 2: MVP 可用（Week 8）
✅ **标准**:
- [ ] API 能创建/销毁 Workspace
- [ ] 前端能连接到远程编辑器
- [ ] 能创建文件并看到内容

### Milestone 3: 完整体验（Week 12）
✅ **标准**:
- [ ] 文件树、编辑器、预览三位一体
- [ ] Agent 修改文件，前端实时可见
- [ ] 用户体验接近 Atoms.dev 70%

### Milestone 4: 生产就绪（Week 16）
✅ **标准**:
- [ ] Race Mode 可用
- [ ] 自动扩缩容工作
- [ ] 支持 100+ 并发 Workspace

### Milestone 5: 正式发布（Week 20）
✅ **标准**:
- [ ] 监控告警全覆盖
- [ ] 成本控制在预算内
- [ ] 用户满意度 > 4.0/5

---

## 🚀 快速启动方案（MVP 捷径）

如果资源有限，可以先实现 **MVP 版本**（8 周）：

### 简化架构

```
跳过 K8s，使用 Docker Compose + Nginx

Nginx (反向代理)
    ├── /ws/project-1 → localhost:3001 (code-server)
    ├── /ws/project-2 → localhost:3002 (code-server)
    └── /api → API Server
```

### 裁剪功能

| 功能 | 完整版 | MVP 版 |
|------|--------|--------|
| 容器编排 | K8s | Docker Compose |
| 存储 | EFS | 本地磁盘 |
| 自动扩缩容 | ✅ | ❌ |
| Race Mode | ✅ | ❌ |
| 高可用 | ✅ | ❌ |
| 多用户实时协作 | ✅ | ❌ |

### MVP 工作量

| 角色 | 人天 |
|------|------|
| DevOps | 15d |
| Backend | 20d |
| Frontend | 25d |
| **总计** | **60d (3 人月)** |

### MVP 验收
- 能创建 Project
- 能打开 Web IDE
- Agent 能修改文件
- 前端能看到修改

---

## 📋 待决策清单

### 🔴 阻塞项（必须在 Phase 1 前决定）

- [ ] **K8s 供应商**: AWS EKS / GCP GKE / 阿里云 ACK / 自建？
- [ ] **存储方案**: EFS / EBS / NFS / Longhorn？
- [ ] **编辑器方案**: code-server / Theia / 自研 Monaco？
- [ ] **网络方案**: 子域名 / 路径路由 / 专用域名？

### 🟡 重要项（影响 Phase 2-3 设计）

- [ ] **资源限制**: 每个 Workspace 多少 CPU/内存？
- [ ] **空闲策略**: 多久无操作自动停止？
- [ ] **数据保留**: 删除 Project 后数据保留多久？
- [ ] **Agent 并发**: 单 Workspace 支持多少 Agent？

### 🟢 优化项（可延后）

- [ ] **多区域部署**: 是否需要在多个地域部署？
- [ ] **私有云支持**: 是否支持用户自有 K8s？
- [ ] **离线模式**: 是否支持断网编辑后同步？

---

## 附录: 团队配置建议

### 理想团队（6 个月交付）

| 角色 | 人数 | 职责 |
|------|------|------|
| Tech Lead | 1 | 架构设计、技术决策 |
| DevOps Engineer | 2 | K8s、CI/CD、监控 |
| Backend Engineer | 2 | Controller、API、Agent |
| Frontend Engineer | 2 | 编辑器集成、UI/UX |
| QA Engineer | 1 | 测试、自动化 |

### 最小团队（MVP 8 周）

| 角色 | 人数 | 职责 |
|------|------|------|
| Full-stack Engineer | 2 | 前后端开发 |
| DevOps Engineer | 1 | 基础设施 |
| 总计 | 3人 | 紧密协作 |

---

**文档结束**  
**建议下一步**: 召开技术评审会，决策阻塞项，分配资源启动 Phase 1
