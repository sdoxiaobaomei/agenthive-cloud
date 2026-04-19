# DevOps → 平台架构师 进化路线图

> **定位**: 个人职业发展路线，基于 AgentHive 项目实践，从当前状态到平台架构师的完整能力建设路径。
>
> **最后更新**: 2026-04-18

---

## 当前位置 📍

```
已掌握 (Tier 1)
├── ✅ Terraform 语法 + 阿里云 Provider
├── ✅ 远程 State (OSS) + 锁定 (OTS)
├── ✅ 模块化设计 (vpc / k8s)
├── ✅ Workspace 多环境隔离
├── ✅ ACK 托管 K8s 集群 + 节点池
├── ✅ Docker + K8s 基础概念
└── ✅ 全栈开发经验 (Vue3 + Node.js/Express)

待补齐 (Tier 2-6)
```

---

## Tier 2: 自动化流水线（1-2 个月）

**核心目标**: 让 `terraform apply` 不再在本地手动执行。

| 技能点 | 具体内容 | 面试价值 |
|--------|---------|----------|
| **GitHub Actions / GitLab CI** | PR 触发 `terraform plan` → 输出贴到 PR 评论 → Code Review → Merge → 自动 `terraform apply` | 100% 会问：你的 CI/CD 流程是什么？ |
| **OIDC 认证** | GitHub Actions 通过 OIDC 获取阿里云临时 STS Token，**彻底抛弃 AccessKey** | 安全红线，高级岗必问 |
| **预发环境流水线** | staging 自动部署，prod 人工审批（approval gate） | 生产安全 |
| **安全扫描接入 CI** | tfsec / checkov 在构建阶段拦截高危配置 | 左移安全 |

**AgentHive 实操项目**:
> 编写 `.github/workflows/terraform.yml`：每次提交到 `iac/` 目录时，自动对 `demo-ask` 执行 `terraform plan`，结果作为 PR 评论。

**面试话术**:
> "我在 AgentHive 中实现了完整 GitOps 流水线：PR 自动触发 Terraform Plan 并评论，合并后通过 OIDC 临时凭证自动 Apply，完全不需要本地 AccessKey。"

---

## Tier 3: 可观测性体系（2-3 个月）

**核心目标**: 系统出问题你能第一时间知道，而不是等用户投诉。

| 技能点 | 具体内容 | 为什么重要 |
|--------|---------|-----------|
| **Prometheus + Grafana** | 部署 kube-prometheus-stack，采集 K8s 指标，自定义 Dashboard | SRE 核心能力 |
| **日志聚合** | Loki (轻量) 或阿里云 SLS，收集应用日志和容器 stdout | 线上排障基础 |
| **告警体系** | AlertManager + 钉钉/飞书 Webhook，CPU > 80%、Pod CrashLoopBackOff | 从被动灭火到主动预防 |
| **分布式追踪** | Jaeger / SkyWalking（可选，高级） | 微服务性能分析 |

**AgentHive 实操项目**:
> 在 ACK 部署 `kube-prometheus-stack`，创建 Dashboard 展示 API QPS/延迟/错误率。配置告警：Pod 重启 > 3 次/5分钟时发钉钉通知。

**面试话术**:
> "我们部署了 kube-prometheus-stack，定义了 99.9% SLO，通过 AlertManager 接入钉钉，平均故障发现时间从 30 分钟降到 2 分钟。"

---

## Tier 4: 应用层部署 + GitOps（2-3 个月）

**核心目标**: 用代码管理应用部署，而不是 `kubectl apply`。

| 技能点 | 具体内容 | 为什么重要 |
|--------|---------|-----------|
| **Helm** | 把 API / Web / Landing 写成 Helm Chart | K8s 应用标准打包 |
| **Kustomize** | base + overlays/dev + overlays/prod | 大厂常用的多环境管理 |
| **Terraform Kubernetes Provider** | 用 Terraform 管理 Helm Release、Namespace、ConfigMap | 统一 IaC |
| **ArgoCD / Flux** | 仓库变更自动同步到集群，支持回滚 | GitOps 终极形态 |

**AgentHive 实操项目**:
> 创建 `iac/helm-charts/agenthive/` Helm Chart（API + Web + Landing），用 Terraform `helm_release` 部署到 ACK，最后用 ArgoCD 做 GitOps 同步。

**面试话术**:
> "应用层使用 Helm 打包，Terraform 统一部署，ArgoCD 持续交付，回滚只需要一次 Git revert。"

---

## Tier 5: 安全与治理（贯穿始终）

**核心目标**: 平台架构师必须回答"怎么保证不出安全事故"。

| 技能点 | 具体内容 | 为什么重要 |
|--------|---------|-----------|
| **Terraform 静态扫描** | tfsec / checkov / terraform-compliance，CI 自动扫描 | 安全左移 |
| **密钥管理** | HashiCorp Vault 或阿里云 KMS，不用明文放 Secret | 泄露 = P0 事故 |
| **镜像安全** | Trivy / Snyk 扫描容器镜像漏洞 | K8s 70% 攻击面来自镜像 |
| **RBAC 精细化** | ServiceAccount + Role + RoleBinding | 最小权限 |
| **网络策略** | K8s NetworkPolicy，Pod 间通信白名单 | 零信任基础 |

**AgentHive 实操项目**:
> CI 集成 tfsec 扫描 Terraform 代码（OSS Bucket 是否公开、安全组是否开放 0.0.0.0/0）。Trivy 扫描 API 镜像。

**面试话术**:
> "CI 阶段就跑 tfsec 和 Trivy，镜像漏洞在构建阶段就拦截，没有高危漏洞才允许推送到 Harbor。"

---

## Tier 6: 平台工程（架构师级别，6-12 个月后）

从"DevOps 工程师"到"平台架构师"的质变。

| 方向 | 核心能力 | 代表工具 |
|------|---------|---------|
| **内部开发者平台 (IDP)** | 业务开发自助申请 DB/缓存/K8s Namespace | Backstage、Port、KubeVela |
| **自助化基础设施** | 暴露 YAML/Form，自动创建全部资源 | Terraform + Custom Controller |
| **FinOps** | 成本可视化与优化 | Kubecost、阿里云成本管家 |
| **多集群管理** | 一个控制面管理多 ACK 集群 | Karmada、Fleet |
| **服务网格** | Istio 流量治理、灰度发布、熔断 | Istio / Linkerd |

**面试话术**:
> "我们正在建设内部开发者平台，业务团队通过 Backstage 自助申请 Redis/MySQL/K8s 资源，申请单自动转成 Terraform PR。"

---

## 推荐学习顺序

```
第 1-2 月  ━━━━ CI/CD 流水线（GitHub Actions + OIDC）
            ━━━━ 同步：tfsec 安全扫描接入 CI

第 3-4 月  ━━━━ 可观测性（Prometheus + Grafana + 告警）
            ━━━━ 同步：Helm 化 AgentHive 应用

第 5-6 月  ━━━━ GitOps（ArgoCD 或 Flux）
            ━━━━ 同步：Kustomize 多环境管理

第 7-12 月 ━━━━ 平台工程（Backstage / KubeVela）
            ━━━━ 深度：成本优化 + 多集群 + Istio
```

---

## 核心认知

> **你现在要补的不是"更多 Terraform 语法"，而是"Terraform 怎么落地到生产环境"：谁跑它、什么时候跑、跑错了怎么回滚、怎么监控、怎么保证安全。**
>
> 这四个问题的答案，就是 DevOps → 平台架构师的完整路径。

---

## 推荐资源

| 类型 | 推荐 |
|------|------|
| CI/CD | [GitHub Actions 官方](https://docs.github.com/actions) + [Atlantis](https://www.runatlantis.io/) |
| K8s 监控 | [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts) |
| Helm | [Helm Docs](https://helm.sh/docs/) + [Bitnami Charts](https://github.com/bitnami/charts) |
| GitOps | [ArgoCD 官方](https://argo-cd.readthedocs.io/) |
| 安全扫描 | [tfsec](https://github.com/aquasecurity/tfsec) + [Trivy](https://github.com/aquasecurity/trivy) |
| 平台工程 | [Backstage](https://backstage.io/) + [Platform Engineering 社区](https://platformengineering.org/) |
