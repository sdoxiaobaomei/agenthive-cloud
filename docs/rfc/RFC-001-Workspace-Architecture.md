# RFC-001: Workspace 架构设计研究

> **状态**: 🟡 待讨论 / 待实现  
> **类型**: 架构设计 / 基础设施  
> **创建日期**: 2026-04-07  
> **相关模块**: landing, api, agent-runtime, 基础设施

---

## 执行摘要

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

| 方案 | 代表产品 | 隔离级别 | 复杂度 | 成本 | 适用场景 |
|------|----------|----------|--------|------|----------|
| **后端集中式** | 早期 Gitpod | 进程级 | 低 | 低 | MVP/小团队 |
| **K8s Pod 隔离** | **Atoms.dev** | **容器级** | **中** | **中** | **目标架构** |
| **微服务拆分** | GitHub Codespaces | 服务级 | 高 | 高 | 企业级 |
| **VM 虚拟机** | AWS Cloud9 | VM 级 | 高 | 高 | 重隔离场景 |

### 3.1 方案对比详细分析

#### 方案 A: K8s Pod 隔离 (推荐)

```
优势:
✅ 资源隔离 (CPU/内存限制)
✅ 快速启动 (秒级)
✅ 共享存储 (EFS/NAS)
✅ 自动扩缩容

劣势:
⚠️ K8s 学习曲线
⚠️ 需要管理基础设施
⚠️ 成本较高 (~¥1500/月起)
```

#### 方案 B: Docker Compose (当前/过渡)

```
优势:
✅ 简单，本地即可运行
✅ 成本低 (单台 ECS ¥60/月)
✅ 快速迭代

劣势:
❌ 无高可用
❌ 无法水平扩展
❌ 单点故障
```

---

## 4. 推荐架构演进路线

### Phase 1: 当前架构优化 (已实施)
- ✅ PostgreSQL + Redis 持久化
- ✅ 文件 API 完善
- ✅ Agent Runtime 基础功能

### Phase 2: 过渡方案 (建议)
- 使用 Docker Compose 多实例
- Nginx 路径路由 (/workspace/:id)
- 共享存储改为 Volume 挂载

### Phase 3: 目标架构 (6个月)
- ACK/EKS 集群
- Workspace = Pod 模式
- 共享 EFS 存储
- 自动扩缩容

---

## 5. 实施路线图

### 总览 (6 个月，135 人天)

| Phase | 时间 | 目标 | 人天 |
|-------|------|------|------|
| Phase 1 | Week 1-4 | 基础设施搭建 | 20d |
| Phase 2 | Week 5-8 | Workspace 核心服务 | 30d |
| Phase 3 | Week 9-12 | 前端集成 | 35d |
| Phase 4 | Week 13-16 | Agent 集成 | 30d |
| Phase 5 | Week 17-20 | 部署与运维 | 20d |

### 人员配置

| 角色 | 人天 | 主要工作 |
|------|------|----------|
| **DevOps** | 45d | K8s 集群、镜像、CI/CD、监控 |
| **Backend** | 50d | Controller、API、Agent 改造 |
| **Frontend** | 40d | 远程编辑器、预览、协作 UI |

### MVP 捷径 (8 周，60 人天)

如果资源有限，可以跳过 K8s，使用 Docker Compose + Nginx 实现简化版：
- ❌ 自动扩缩容
- ❌ 高可用
- ❌ Race Mode
- ✅ Web IDE
- ✅ Agent 文件操作

---

## 6. 成本分析

### 阿里云 ACK 成本

| 计费项 | 单价 | 是否可省 |
|--------|------|----------|
| **ACK 托管集群 Pro 版** | **¥0.64/小时 (~¥460/月)** | ❌ 必须 |
| ECS 节点 (Worker) | ¥0.1-0.5/小时 | ✅ 可释放 |
| 块存储 | ¥0.7-1.0/GB/月 | ✅ 随节点释放 |
| 负载均衡 CLB | ¥0.025/小时 | ✅ 可删除 |

### 场景成本

| 场景 | 月成本 | 说明 |
|------|--------|------|
| **开发测试** | **¥600** | 白天工作，晚上释放节点 |
| **MVP 生产** | **¥1,500** | 固定 2 节点 |
| **完整生产** | **¥3,000-4,500** | 3 节点 + 自动扩缩容 |

### 成本优化策略

```yaml
# 自动关机策略
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 0  # 可缩到 0
  maxReplicas: 100
  
# 抢占式实例（节省 70%）
instanceChargeType: Spot
spotPriceLimit: 0.20
```

### 云厂商对比

| 云厂商 | 产品 | 3节点4c8g月成本 | 特点 |
|--------|------|----------------|------|
| **阿里云** | ACK | **¥1,466** | 国内延迟低，ASK 唯一成熟 |
| **AWS** | EKS | ~¥1,800 | 生态最全，贵 |
| **GCP** | GKE | ~¥1,440 | 自动扩缩容强 |

---

## 7. 决策清单

### 🔴 阻塞项（Phase 1 前决定）

- [ ] **K8s 供应商**: AWS EKS / GCP GKE / 阿里云 ACK
- [ ] **存储方案**: EFS / EBS / NAS / Longhorn
- [ ] **编辑器方案**: code-server / Theia / 自研 Monaco
- [ ] **网络方案**: 子域名 / 路径路由 / 专用域名

### 🟡 重要项（影响 Phase 2-3）

- [ ] **资源限制**: 每个 Workspace CPU/内存配额
- [ ] **空闲策略**: 多久无操作自动停止
- [ ] **数据保留**: 删除 Project 后数据保留多久
- [ ] **Agent 并发**: 单 Workspace 支持多少 Agent

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| K8s 学习曲线 | 高 | 延期 2-4 周 | 使用 managed K8s |
| code-server 定制困难 | 中 | 功能受限 | 提前 POC |
| 成本超支 | 中 | 项目砍减 | 严格监控，设置预算告警 |

---

## 9. 附录

### 9.1 相关文档

- [部署指南](../deployment/README.md) - 详细部署方案
- [实施计划](#) - 完整 20 周实施计划
- [成本分析](../deployment/cost-analysis.md) - 各方案详细成本

### 9.2 参考资源

- [Atoms.dev](https://atoms.dev) - 目标体验参考
- [GitHub Codespaces](https://github.com/features/codespaces) - 竞品参考
- [阿里云 ACK 文档](https://www.aliyun.com/product/kubernetes)

---

**文档结束**

**建议下一步**: 召开技术评审会，决策阻塞项，分配资源启动 Phase 1
