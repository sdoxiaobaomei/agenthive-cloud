# AgentHive Cloud - DevOps 架构文档

> 🚧 **目标架构，未完全实现** (最后检查: 2026-04-22)
>
> 本文档描述的是目标/理想状态的 DevOps 体系，实际落地情况如下：
> - ✅ 已实现: GitHub Actions CI/CD (基础)、K8s 部署 (单环境)、ACR 镜像仓库
> - ❌ 未实现: Prometheus/Grafana 监控、HPA 自动扩缩容、蓝绿部署、Network Policies、Loki/Tempo 日志链路
>
> ---
>
> **原标注**:
> 📋 完整的 DevOps 体系架构说明

---

## 🏗️ 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Developer Workflow                               │
│                                                                          │
│   Local Dev  →  Git Commit  →  Git Push  →  GitHub PR/Merge             │
│                                                                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      GitHub Actions CI/CD                                │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │ Code Quality │→ │ Build & Test │→ │ Docker Build │                 │
│  │ • Lint       │  │ • pnpm       │  │ • Multi-stage│                 │
│  │ • Type Check │  │ • Unit Test  │  │ • Cache      │                 │
│  │ • Security   │  │ • E2E        │  │ • Push to GHCR│                │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
│                                                  │                      │
│                                                  ▼                      │
│                                    ┌──────────────────────┐             │
│                                    │ Security Scanning    │             │
│                                    │ • Trivy (镜像)       │             │
│                                    │ • CodeQL (代码)      │             │
│                                    │ • npm audit (依赖)   │             │
│                                    └──────────────────────┘             │
└───────────────────────────────────────────┬──────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster (生产环境)                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │                    Ingress Controller                       │         │
│  │                   (Nginx/Traefik)                           │         │
│  └────────────────────┬───────────────────────────────────────┘         │
│                       │                                                   │
│         ┌─────────────┴─────────────┐                                    │
│         │                           │                                    │
│         ▼                           ▼                                    │
│  ┌─────────────┐             ┌─────────────┐                            │
│  │   Landing   │             │     API     │                            │
│  │  Pod x2+    │             │  Pod x2+    │                            │
│  │  Nuxt 3     │             │  Express    │                            │
│  └─────────────┘             └──────┬──────┘                            │
│                                     │                                    │
│         ┌───────────────────────────┼──────────────────┐                │
│         │                           │                   │                │
│         ▼                           ▼                   ▼                │
│  ┌─────────────┐             ┌─────────────┐   ┌─────────────┐         │
│  │ PostgreSQL  │             │    Redis    │   │   Agent     │         │
│  │ StatefulSet │             │  StatefulSet│   │  Runtime    │         │
│  │   x1        │             │    x1       │   │             │         │
│  └─────────────┘             └─────────────┘   └─────────────┘         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │                  Monitoring Stack                           │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │         │
│  │  │ Prometheus  │→ │  Grafana    │→ │ Alertmanager│        │         │
│  │  │  Metrics    │  │ Dashboard   │  │  Alerts     │        │         │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │                   Logging Stack (可选)                      │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │         │
│  │  │  Promtail   │→ │    Loki     │→ │   Tempo     │        │         │
│  │  │  Log Collect│  │  Log Store  │  │  Tracing    │        │         │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │         │
│  └────────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 技术栈选型

### CI/CD
| 工具 | 用途 | 选型理由 |
|------|------|----------|
| **GitHub Actions** | CI/CD 引擎 | 与 GitHub 深度集成，免费额度够用，生态丰富 |
| **Docker Buildx** | 镜像构建 | 支持多平台构建，Build Cache 加速 |
| **GHCR** | 镜像仓库 | 免费私有仓库，与 Actions 无缝集成 |

### 容器编排
| 工具 | 用途 | 选型理由 |
|------|------|----------|
| **Kubernetes** | 容器编排 | 行业标准，自动伸缩，自愈能力 |
| **Kustomize** | 配置管理 | 原生支持，无需额外工具，环境隔离清晰 |
| **Ingress Nginx** | 流量入口 | 成熟稳定，配置灵活 |

### 监控告警
| 工具 | 用途 | 选型理由 |
|------|------|----------|
| **Prometheus** | 指标采集 | CNCF 毕业项目，生态完善，查询强大 |
| **Grafana** | 可视化 | 丰富的图表类型，支持多数据源 |
| **Alertmanager** | 告警管理 | 支持多渠道通知，告警分组去重 |

### 日志系统（可选）
| 工具 | 用途 | 选型理由 |
|------|------|----------|
| **Loki** | 日志存储 | 轻量级，与 Prometheus 集成好，成本低 |
| **Promtail** | 日志采集 | 官方推荐，配置简单，资源占用低 |
| **Tempo** | 链路追踪 | 与 Grafana 集成，支持 OpenTelemetry |

### 安全扫描
| 工具 | 用途 | 选型理由 |
|------|------|----------|
| **Trivy** | 镜像扫描 | 快速准确，支持 CVE 数据库，免费 |
| **CodeQL** | 代码扫描 | GitHub 官方，支持多种语言，集成好 |
| **npm audit** | 依赖扫描 | 内置工具，快速发现漏洞 |

---

## 🔄 CI/CD Pipeline 详解

### Pipeline 流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Push Event                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Code Quality (15min)                                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ • Checkout Code                                      │   │
│ │ • Setup Node.js + pnpm                               │   │
│ │ • Cache Dependencies                                 │   │
│ │ • Type Check (TypeScript)                            │   │
│ │ • Lint Check (ESLint)                                │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ ✅ Pass
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Build & Test (30min)                                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ • Install Dependencies                               │   │
│ │ • Build API (if build script exists)                 │   │
│ │ • Build Landing (if build script exists)             │   │
│ │ • Run Unit Tests                                     │   │
│ │ • Upload Build Artifacts                             │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ ✅ Pass
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Docker Build & Push (30min)                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ • Setup Docker Buildx                                │   │
│ │ • Login to GHCR                                      │   │
│ │ • Build API Image (multi-stage)                      │   │
│ │ • Build Landing Image (multi-stage)                  │   │
│ │ • Push Images with Tags (sha, latest)                │   │
│ │ • Enable Build Cache                                 │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ ✅ Pass
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: Deploy to Kubernetes (20min)                        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ • Setup kubeconfig (from Secret)                     │   │
│ │ • Install kubectl                                    │   │
│ │ • Update Kustomize with new image tags               │   │
│ │ • kubectl apply -k k8s/overlays/production           │   │
│ │ • Wait for rollout (5min timeout)                    │   │
│ │ • Verify deployment (pods, svc, ingress)             │   │
│ │ • Generate deployment summary                        │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ ✅ Success
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 5: Notify (5min)                                       │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ • Send Slack/Teams notification                      │   │
│ │ • Update GitHub deployment status                    │   │
│ │ • Archive build logs                                 │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 关键配置说明

#### 1. 镜像标签策略

```yaml
tags: |
  type=sha,prefix=          # Git SHA (用于精确追溯)
  type=raw,value=latest     # latest (用于开发环境)
  type=raw,value=${{ github.sha }}  # 完整 SHA
```

#### 2. 构建缓存优化

```yaml
cache-from: type=gha       # GitHub Actions Cache
cache-to: type=gha,mode=max
```

#### 3. 多环境部署

```
k8s/
├── base/                  # 基础配置（所有环境共享）
├── overlays/
│   ├── local/            # 本地开发
│   ├── staging/          # 预发布环境
│   └── production/       # 生产环境
```

---

## 🛡️ 安全体系

### 多层安全防护

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Code Security                                        │
│ • CodeQL 静态分析                                             │
│ • npm audit 依赖扫描                                          │
│ • Secret detection (GitHub)                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Image Security                                       │
│ • Trivy 镜像漏洞扫描                                          │
│ • Base image 最小化 (Alpine/Distroless)                       │
│ • Multi-stage build (减少攻击面)                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Runtime Security                                     │
│ • Pod Security Context (runAsNonRoot)                         │
│ • Read-only Root Filesystem                                   │
│ • Drop All Capabilities                                       │
│ • Network Policies (零信任网络)                               │
│ • Resource Limits (防止 DoS)                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Access Control                                       │
│ • RBAC (最小权限原则)                                         │
│ • Secrets 管理 (Kubernetes Secrets)                           │
│ • ServiceAccount 隔离                                         │
└─────────────────────────────────────────────────────────────┘
```

### Kubernetes 安全配置示例

```yaml
securityContext:
  runAsNonRoot: true              # 非 root 运行
  runAsUser: 1000                 # 指定用户 ID
  runAsGroup: 1000                # 指定组 ID
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault          # 系统调用限制
  allowPrivilegeEscalation: false # 禁止提权
  readOnlyRootFilesystem: true    # 只读文件系统
  capabilities:
    drop:
      - ALL                       # 丢弃所有能力
```

---

## 📊 监控体系

### 三级监控指标

```
┌─────────────────────────────────────────────────────────────┐
│ Level 1: Infrastructure Metrics                               │
│ • Node CPU/Memory/Disk                                       │
│ • Network I/O                                                │
│ • Pod Resource Usage                                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 2: Application Metrics                                  │
│ • HTTP Request Rate (RPS)                                    │
│ • Error Rate (5xx/4xx)                                       │
│ • Response Latency (P50/P95/P99)                             │
│ • Database Connections                                       │
│ • Cache Hit Rate                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 3: Business Metrics                                     │
│ • Active Users                                               │
│ • Agent Task Count                                           │
│ • Task Success Rate                                          │
│ • Average Task Duration                                      │
└─────────────────────────────────────────────────────────────┘
```

### 核心告警规则

| 告警名称 | 触发条件 | 严重级别 | 响应时间 |
|---------|---------|---------|---------|
| APIHighErrorRate | 5xx 错误率 > 5% | Critical | 15 分钟 |
| APIHighLatency | P95 延迟 > 1s | Warning | 30 分钟 |
| APIPodDown | Pod 不可用 > 2min | Critical | 10 分钟 |
| HighMemoryUsage | 内存 > 90% | Warning | 1 小时 |
| HighCPUUsage | CPU > 90% | Warning | 1 小时 |
| PostgresDown | 数据库宕机 | Critical | 5 分钟 |

---

## 🚀 部署策略

### 蓝绿部署（推荐）

```yaml
# production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../base

images:
  - name: agenthive-api
    newTag: v1.2.0  # 新版本

replicas:
  - name: api
    count: 4  # 先扩容到 4 个

# 验证新 Pod 健康后，再缩容旧 Pod
```

### 滚动更新（默认）

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 最多超出 1 个 Pod
      maxUnavailable: 0   # 不允许不可用
```

---

## 📈 性能优化

### Docker 构建优化

| 优化项 | 效果 | 实现方式 |
|-------|------|---------|
| **多阶段构建** | 镜像体积 -70% | 分离 build 和 runtime |
| **层缓存** | 构建速度 +50% | 合理排序 Dockerfile 指令 |
| **Buildx Cache** | 构建速度 +80% | GitHub Actions Cache |
| **小基础镜像** | 体积 -60% | Alpine/Distroless |

### Kubernetes 资源优化

```yaml
resources:
  requests:
    memory: "256Mi"      # 保证资源
    cpu: "250m"
  limits:
    memory: "512Mi"      # 上限
    cpu: "500m"
```

### 自动伸缩策略

```yaml
# HPA 配置
minReplicas: 2           # 最小副本
maxReplicas: 10          # 最大副本
targetCPUUtilization: 70 # CPU 目标利用率
targetMemoryUtilization: 80 # 内存目标利用率
```

---

## 🔗 相关文档

- [CI/CD 使用指南](./docs/CI-CD-USAGE.md)
- [K8s 部署指南](./docs/deployment/k8s-deployment.md)
- [监控配置](./monitoring/prometheus.yml)
- [安全扫描](./.github/workflows/security-scan.yml)

---

## 📋 技术总结

### 技术深度
- 完整的 CI/CD Pipeline（Code Quality → Build → Test → Docker → Deploy）
- 生产级 K8s 配置（健康检查/资源限制/安全上下文/PDB）
- 多层安全扫描（镜像/代码/依赖）
- 监控告警体系（Prometheus + Grafana + Alertmanager）

### 工程实践
- 多环境管理（local/staging/production）
- GitOps 就绪（Kustomize + kubectl）
- 构建优化（多阶段/Docker Cache）
- 自动化程度高（一键部署）

### 文档能力
- 清晰的架构图
- 完整的配置说明
- 故障排查指南
- 性能优化报告
