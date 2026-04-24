# 项目文档审计报告

> **审计日期**: 2026-04-22
> **审计人**: 基于 ACK Demo 集群实战部署经验
> **审计范围**: 全部 56+ 篇文档，重点审查部署/运维/K8s 相关文档

---

## 审计方法

本次审计以 **2026-04-22 实际部署到阿里云 ACK 集群** 的经验为基准，逐篇对比文档描述与实战结果的差异。

**实战背景**:
- 集群: 阿里云 ACK `agenthive-demo-ask` (cn-hangzhou)
- 部署内容: API + Landing + Redis + RabbitMQ + Ingress + cert-manager
- 实际耗时: 全天（含 12+ 个踩坑修复）
- 关键问题: Docker Hub 超时、镜像缓存、CORS、证书、Kustomize 合并陷阱等

---

## 一、模拟文档（未经验证，存在严重错误）

### 🔴 `docs/deployment/k8s-deployment.md` — 严重过时

**问题清单**:
| 文档描述 | 实战结果 | 严重程度 |
|---------|---------|---------|
| `envFrom.configMapRef` 一次性引入所有配置 | 实际 base/04-api.yaml 是逐个 key 显式引用，新增 key 不会自动映射 | 🔴 高 |
| Ingress 使用 `/api` 路径前缀路由 | 实际使用子域名 `api.xiaochaitian.asia` 避免 CORS 和路径冲突 | 🔴 高 |
| 未提及镜像拉取问题 | 杭州 ACK 节点无法直接拉取 Docker Hub，必须推送到 ACR | 🔴 高 |
| 未提及 `latest` 缓存陷阱 | `IfNotPresent` + `latest` 导致节点使用旧镜像，需设 `Always` | 🔴 高 |
| init container 直接用 `busybox:1.36` | 国内环境拉取 Docker Hub 超时，需用 ACR 镜像 | 🔴 高 |
| 未提及 CORS 配置 | 跨子域访问必须配置 `CORS_ORIGIN`，且需在 Deployment 中显式引用 | 🟡 中 |
| 未提及 `/data` 目录可写性 | `readOnlyRootFilesystem: true` + 缺少 emptyDir 导致 `ENOENT` | 🟡 中 |
| 预计部署时间 "2-3 天" | 仅基础部署就耗费全天处理各种问题 | 🟡 中 |
| 使用 `postgres:16-alpine` 直接拉取 | 国内环境需使用 ACR 镜像或镜像代理 | 🟡 中 |

**处理建议**: **添加 `⚠️ 未经验证 - 2026-04-22` 标注头部，并指向实战文档 `ack-demo-deployment-notes.md`**

---

### 🔴 `docs/deployment/hybrid-deployment.md` — 纯理论方案

**问题清单**:
| 文档描述 | 实战结果 | 严重程度 |
|---------|---------|---------|
| Cloudflare Tunnel 方案完全未经实战 | 没有任何实际部署记录 | 🔴 高 |
| 成本估算 ¥5/月 | 未考虑实际运维、调试、网络波动成本 | 🟡 中 |
| 演示脚本 `start-interview.sh` | 纯模拟代码，未在任何环境中运行过 | 🟡 中 |
| 未提及国内访问 Cloudflare 的速度问题 | 实际体验可能极差，无法用于演示 | 🟡 中 |
| 未提及证书管理的实际操作 | Let's Encrypt / 自签名证书的配置完全缺失 | 🟡 中 |

**处理建议**: **添加 `🚧 纯理论方案，未经验证` 标注头部**

---

### 🔴 `docs/archive/DEPLOYMENT.md` — 严重过时

**问题清单**:
| 文档描述 | 实战结果 | 严重程度 |
|---------|---------|---------|
| Docker Compose 配置中 Landing 端口 3000 | 实际 Landing 监听端口 80（Nuxt Nitro 默认） | 🔴 高 |
| Nginx upstream `landing:3000` | 端口错误，应为 80 | 🔴 高 |
| `NUXT_PUBLIC_API_BASE=http://localhost:3001` | 硬编码本地地址，生产环境不可用 | 🔴 高 |
| K8s 成本 $185/月 vs ECS $30/月 | ACK Demo 实际成本约 ¥0.6/小时，文档数字无依据 | 🔴 高 |
| 未提及任何国内云环境问题 | Docker Hub 超时、ACR、SLB 等均未涉及 | 🔴 高 |

**处理建议**: **已在 `docs/archive/` 目录，添加 `⚠️ 严重过时 - 2026-04-22` 标注，建议后续删除**

---

### 🟡 `docs/DEVOPS-ARCHITECTURE.md` — 过度设计，未落地

**问题清单**:
| 文档描述 | 实际状态 | 严重程度 |
|---------|---------|---------|
| Prometheus + Grafana + Alertmanager | 未部署 | 🔴 高 |
| Loki + Promtail + Tempo | 未部署 | 🔴 高 |
| Network Policies (零信任网络) | 未配置 | 🔴 高 |
| HPA 自动扩缩容 | 未配置，当前固定单副本 | 🔴 高 |
| 蓝绿部署配置 | 未实现 | 🟡 中 |
| `k8s/overlays/production` 目录 | **不存在** | 🔴 高 |
| `.github/workflows/security-scan.yml` | **不存在** | 🔴 高 |
| GHCR 镜像仓库 | 实际使用阿里云 ACR | 🟡 中 |

**处理建议**: **添加 `🚧 目标架构，未完全实现` 标注头部，并列出已实现 vs 未实现项**

---

## 二、部分过时文档（需要补充标注）

### 🟡 `docs/HANDS-ON-K8S-MIGRATION.md` — 仅限本地环境

**问题**:
- 基于 Docker Desktop / Kind，使用 `imagePullPolicy: Never`
- `storageClassName: hostpath` 仅适用于本地
- 未提及国内镜像拉取问题
- 未提及证书管理

**处理建议**: **添加 `⚠️ 仅适用于本地开发环境` 标注头部**

---

### 🟡 `docs/CI-CD-USAGE.md` — 需要验证

**问题**:
- 引用的 PowerShell 脚本可能已过时
- 未提及 ACR 实际使用方式
- 未提及 `latest` 标签缓存问题

**处理建议**: **添加 `⚠️ 部分信息需验证更新` 标注头部**

---

### 🟡 `iac/alicloud/terraform/demo-ask/README.md` — 轻微过时

**问题**:
- 提到 `ecs.u2a-c1m1.xlarge` 实例类型，实际使用 `ecs.c7.xlarge`
- 其余内容基本准确

**处理建议**: **更新实例类型信息**

---

## 三、经验证实战文档（保留，作为标杆）

### ✅ `docs/deployment/ack-demo-deployment-notes.md`（今日新建）
- 基于真实部署经验
- 包含 7 个踩坑记录和解决方案

### ✅ `docs/lessons-learned-iac-cicd.md`
- 记录了 2026-04-19~20 的真实 CI/CD 测试
- 9 次 Apply 尝试、12 个坑点、真实时间线

---

## 四、处理建议汇总

| 文档 | 建议操作 | 优先级 |
|------|---------|--------|
| `docs/deployment/k8s-deployment.md` | 添加 `⚠️ 未经验证` 头部 + 指向实战文档 | P0 |
| `docs/deployment/hybrid-deployment.md` | 添加 `🚧 纯理论方案` 头部 | P0 |
| `docs/archive/DEPLOYMENT.md` | 添加 `⚠️ 严重过时` 头部 | P0 |
| `docs/DEVOPS-ARCHITECTURE.md` | 添加 `🚧 目标架构，未完全实现` 头部 | P0 |
| `docs/HANDS-ON-K8S-MIGRATION.md` | 添加 `⚠️ 仅本地环境` 头部 | P1 |
| `docs/CI-CD-USAGE.md` | 添加 `⚠️ 需验证更新` 头部 | P1 |
| `docs/lessons-learned.md` | 更新日期，添加 K8s 部署教训 | P1 |
| `iac/alicloud/terraform/demo-ask/README.md` | 更新实例类型 | P2 |

---

## 五、经验教训

> **"文档写得越多，解释得越少" —— 但前提是文档经过实战验证。**

本次审计发现的核心问题：

1. **理想 vs 现实差距**: 大量文档基于 Docker Desktop / Kind / 理论假设编写，完全没有考虑国内云环境的网络限制（Docker Hub 超时、镜像源问题）

2. **配置漂移**: `k8s-deployment.md` 描述的 `envFrom.configMapRef` 与实际代码的逐个 key 引用不一致，说明文档和代码是分开维护的

3. **过度设计**: `DEVOPS-ARCHITECTURE.md` 描绘了完整的监控/安全/自动化体系，但实际落地的可能不到 20%

4. **缺乏闭环**: 文档编写后没有跟随实际部署进行验证和更新

**改进建议**:
- 所有部署文档必须跟随至少一次实际部署验证
- 文档头部必须标注 `最后验证日期` 和 `验证环境`
- 理论性/规划性文档必须与已实现文档分开存放
