# GitHub Actions 工作流说明

## 分支管理策略

本项目采用 **简化版 GitHub Flow**，适合 Demo/展示型项目：

```
main (master)  ← 唯一长期分支
    │
    ├── feature/* 或 fix/* 分支 ──► PR ──► CI 检查 ──► Merge
    │
    └── Milestone 完成时打 tag: v0.1.0, v0.2.0...
              └── 可选发布 GitHub Release
```

### 为什么不使用 develop/release 分支？

| 分支 | 用途 | Demo 项目是否需要 |
|------|------|------------------|
| `main` | 唯一长期分支，始终可构建 | ✅ 必需 |
| `feature/*` | 功能开发 | ✅ 必需 |
| `develop` | 隔离开发中和已发布代码 | ❌ PR + CI 已保证 main 稳定性 |
| `release` | 版本发布前冻结窗口 | ❌ Demo 不需要严格版本冻结 |

### Tag 与 Release

- **打 tag**: 推荐。标记里程碑，如 `v0.1.0`（MVP）、`v0.2.0`（Dashboard 完成）
- **语义化版本**: `v主.次.修`，如 `v1.2.3`
- **发 Release**: 推荐。推送 `v*` 标签时自动触发 ACR 镜像构建，GitHub Release 自动生成 changelog

---

## IaC (Infrastructure as Code)

> **核心原则**: IaC 资源**绝不自动创建**，只在需要展示时手动触发，展示完毕后手动销毁。

| 工作流 | 文件 | 触发方式 | 说明 |
|--------|------|----------|------|
| **IaC PR Check** | `iac-pr-check.yml` | PR 修改 `iac/**` | 自动：`fmt` + `validate` + `checkov` + `plan` 评论 |
| **IaC Apply (Demo)** | `iac-apply-demo.yml` | `workflow_dispatch` | **手动**：创建 Demo 环境（约 ¥0.6/小时） |
| **IaC Destroy (Demo)** | `iac-destroy-demo.yml` | `workflow_dispatch` | **手动**：销毁 Demo 环境，停止计费 |
| **IaC Apply (Env)** | `iac-apply-env.yml` | `workflow_dispatch` | **手动**：管理 environments（dev/staging/prod） |

### 使用流程

```
需要展示 Demo
    │
    ├──► Actions → IaC Apply (Demo) → 勾选确认 → 创建资源
    │
    ├──► 展示完毕
    │
    └──► Actions → IaC Destroy (Demo) → 勾选确认 → 销毁资源
```

### 前置配置

在仓库 **Settings → Secrets and variables → Actions** 中添加：

```
ALIYUN_ACCESS_KEY_ID     = 阿里云 AccessKey ID
ALIYUN_ACCESS_KEY_SECRET = 阿里云 AccessKey Secret
```

> ⚠️ **安全提示**: 当前使用 AccessKey 是过渡方案。企业级推荐配置 **阿里云 OIDC 联邦身份**。配置见 `iac/README.md` 的 CI/CD 集成章节。

---

## 应用 CI/CD

| 工作流 | 文件 | 触发方式 | 说明 |
|--------|------|----------|------|
| **CI (代码质量)** | `ci-cd.yml` | PR / push `main` | 自动：type-check、lint、build、test |
| **CD (ACR 镜像)** | `deploy-alicloud.yml` | push `main/staging`、tag `v*`、手动 | 自动：构建并推送镜像到 **阿里云 ACR** |
| **安全扫描** | `security-scan.yml` | PR / push `main` / 每周定时 | 自动：Trivy、npm audit、CodeQL |

### 为什么没有自动部署到 ACK？

本项目定位为 **Demo/展示**，ACK 集群只在需要展示时通过 **IaC Apply (Demo)** 手动创建。镜像推送到 ACR 后，部署到 ACK 的时机由展示者自行控制（手动 kubectl 或在 IaC Apply 后执行）。

---

## 监控镜像构建

| 工作流 | 文件 | 触发方式 | 说明 |
|--------|------|----------|------|
| **监控镜像** | `build-monitoring-images.yml` | push `monitoring/**`、tag `monitoring-v*`、手动 | 构建 Prometheus/Grafana/Node-Exporter 镜像到 ACR |

### 前置配置

```
ACR_USERNAME = 阿里云容器镜像服务用户名
ACR_PASSWORD = 阿里云容器镜像服务密码
```

---

## Workflow 触发条件速查表

| 场景 | 触发的工作流 |
|------|-------------|
| 提交 PR（修改 `apps/**`） | `ci-cd.yml`（代码检查）、`security-scan.yml` |
| 提交 PR（修改 `iac/**`） | `iac-pr-check.yml`（Plan 预览） |
| Push 到 `main`（修改应用代码） | `ci-cd.yml`、`deploy-alicloud.yml`（ACR 镜像）、`security-scan.yml` |
| Push 到 `main`（修改 `monitoring/**`） | `build-monitoring-images.yml` |
| 推送 `v*` 标签 | `deploy-alicloud.yml`（ACR 镜像） |
| 需要展示 Demo 环境 | **手动触发** `iac-apply-demo.yml` |
| Demo 展示完毕 | **手动触发** `iac-destroy-demo.yml` |
| 管理 environments | **手动触发** `iac-apply-env.yml` |
