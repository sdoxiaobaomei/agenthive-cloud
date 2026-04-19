# Infrastructure as Code (IaC) 知识库

> 本知识库聚焦 **阿里云 + Terraform**，整理 AgentHive 项目的基础设施即代码实践。
>
> **最后更新**: 2026-04-18 | **校验状态**: 已重构精简

---

## 目录

1. [知识库定位](#知识库定位)
2. [目录结构](#目录结构)
3. [快速索引](#快速索引)
4. [通用最佳实践](#通用最佳实践)

---

## 知识库定位

**本仓库不是"云厂商百科全书"，而是"可运行的经验积累"。**

- ✅ 保留：**能直接运行**的 Demo 配置
- ✅ 保留：**展示设计模式**的模块骨架
- ❌ 删除：不用的云厂商（AWS/Azure）、不用的场景（Serverless/函数计算）、重复的配置

> 实际工作中，资源配置永远需要根据实际情况定制。这里提供的是**起点和参考**，不是"万能模板"。

---

## 目录结构

```
iac/
├── README.md                              # 本文件
├── TERRAFORM-GUIDE.md                     # Terraform 深度指南（新特性、State 安全、测试框架）
├── .gitignore                             # 忽略 .terraform/、*.tfstate、tfplan 等
│
├── alicloud/                              # 阿里云（主攻）
│   ├── README.md                          # 阿里云资源导航
│   ├── lessons-learned-terraform-demo.md  # ACK Demo 部署踩坑实录
│   ├── ros/
│   │   └── template.yml                   # 资源编排服务（ROS）模板参考
│   └── terraform/
│       ├── demo-ask/                      # ⭐ 最小可用 Demo（轻量 ACK + VPC）
│       │   ├── main.tf                    #   完整注释版，适合学习
│       │   ├── variables.tf
│       │   ├── outputs.tf
│       │   └── terraform.tfvars.example
│       │
│       ├── environments/                  # 多环境管理示例（Terraform Workspace）
│       │   ├── main.tf
│       │   └── variables.tf
│       │
│       └── modules/                       # 可复用模块骨架
│           ├── vpc/                       #   VPC + VSwitch + NAT + EIP
│           │   ├── README.md
│           │   ├── main.tf
│           │   ├── variables.tf
│           │   └── outputs.tf
│           └── k8s/                       #   ACK 集群 + 节点池
│               ├── README.md
│               ├── main.tf
│               ├── variables.tf
│               └── outputs.tf
│
└── shared/
    └── modules/
        └── README.md                      # 跨云共享模块设计思路
```

---

## 快速索引

| 场景 | 推荐入口 | 说明 |
|------|----------|------|
| **零基础学习 Terraform + 阿里云** | `alicloud/terraform/demo-ask/main.tf` | 286 行逐行注释，从 VPC 到 ACK 完整链路 |
| **快速跑一个 Demo 环境** | `alicloud/terraform/demo-ask/` | 一键创建，一键销毁 |
| **理解模块化设计** | `alicloud/terraform/modules/` | VPC 模块 + K8s 模块，展示如何把大文件拆小 |
| **多环境管理（dev/staging/prod）** | `alicloud/terraform/environments/main.tf` | Terraform Workspace + `locals.env_config` |
| **部署踩坑排雷** | `alicloud/lessons-learned-terraform-demo.md` | DNS 解析、库存、权限、计费... |
| **踩坑精华速查** | `TROUBLESHOOTING.md` | 10 个坑点凝练成 5 条法则，部署前快速检查 |
| **Terraform 新特性** | `TERRAFORM-GUIDE.md` | 1.10-1.14 更新、OpenTofu 对比、State 加密 |

---

## 通用最佳实践

### 1. 状态管理

```hcl
terraform {
  backend "oss" {
    bucket = "your-terraform-state"
    prefix = "demo-ask"
    region = "cn-beijing"
  }
}
```

- **禁止本地 state 文件协作** — 必须用远程后端
- **启用状态锁定** — OSS 原生支持，防止并发操作冲突

### 2. 敏感信息

| 做法 | 推荐程度 |
|------|----------|
| `terraform.tfvars` + `.gitignore` | ✅ 个人 Demo |
| 阿里云 KMS + `alicloud_kms_secret` 数据源 | ✅✅ 团队协作 |
| 明文密码写在 `.tf` 文件里 | ❌ 绝对禁止 |

### 3. 模块化

```hcl
module "network" {
  source       = "../modules/vpc"
  project_name = "agenthive"
  zone_ids     = ["cn-beijing-a"]
  # ...
}

module "cluster" {
  source       = "../modules/k8s"
  vpc_id       = module.network.vpc_id
  vswitch_ids  = module.network.vswitch_ids
  # ...
}
```

- **按层拆分**: 网络层 → 计算层 → 数据层
- **接口参数化**: 通过 `variables.tf` 暴露差异，避免复制粘贴

### 4. 安全扫描

在 CI/CD 中集成：

```bash
tflint          # 语法和最佳实践检查
checkov         # 安全合规扫描
trivy           # 漏洞扫描
```

---

## CI/CD 集成

AgentHive 项目已通过 GitHub Actions 实现 IaC 的 PR-Driven 变更流程。

### 已配置的工作流

| 工作流文件 | 触发条件 | 功能 |
|-----------|----------|------|
| `.github/workflows/iac-pr-check.yml` | PR 修改 `iac/**` | `fmt` + `validate` + `checkov` + `plan` 评论 |
| `.github/workflows/iac-apply-demo.yml` | Push `main` 且 `demo-ask/**` 变更 | 自动 `terraform apply` |
| `.github/workflows/iac-apply-env.yml` | `workflow_dispatch` 手动触发 | 选择 workspace 后 `apply`，prod 需审批 |

### 前置配置

在仓库 **Settings → Secrets and variables → Actions** 中添加：

```
ALIYUN_ACCESS_KEY_ID     = 你的阿里云 AccessKey ID
ALIYUN_ACCESS_KEY_SECRET = 你的阿里云 AccessKey Secret
```

> ⚠️ **安全提示**: 当前使用 AccessKey 是过渡方案。企业级推荐配置 **阿里云 OIDC 联邦身份**，彻底消除长期凭证。配置指南见阿里云文档 [RAM OIDC 身份提供商](https://help.aliyun.com/zh/ram/user-guide/create-an-oidc-identity-provider)。

### GitHub Environment 保护规则（推荐配置）

在仓库 **Settings → Environments** 中创建以下环境并配置保护规则：

| 环境 | 保护规则建议 |
|------|-------------|
| `dev` | 无需审批，用于快速验证 |
| `staging` | 1 名审批人（技术负责人） |
| `production` | 2 名审批人（技术负责人 + 运维负责人），限制分支 `main` |

### 使用流程

```
开发者修改 iac/** 文件
        │
        ▼
   创建 PR ───────────────────────┐
        │                         │
        ▼                         │
  GitHub Actions 自动运行          │
  ├── terraform fmt -check        │
  ├── terraform validate          │
  ├── checkov 安全扫描            │
  └── terraform plan → PR 评论    │
        │                         │
        ▼                         │
  Reviewer 审阅代码 + Plan 结果   │
        │                         │
        ▼                         │
   PR 合并到 main ────────────────┘
        │
        ├──► demo-ask 变更 → 自动 apply
        │
        └──► environments 变更 → 手动触发 workflow_dispatch
                                    │
                                    ▼
                              选择 workspace
                                    │
                                    ▼
                              dev: 直接 apply
                              staging: 审批后 apply
                              prod: 多人审批后 apply
```
