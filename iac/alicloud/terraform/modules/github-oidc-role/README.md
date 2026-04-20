# GitHub OIDC 角色模块

> 为 GitHub Actions 创建具备最小权限的阿里云 RAM 角色，彻底消除长期 AccessKey。

---

## 前置条件

1. 阿里云账号已创建 **OIDC 身份提供商**
   - Issuer URL: `https://token.actions.githubusercontent.com`
   - Client ID: `sts.aliyuncs.com`（或你的自定义值）
   - 获取指纹（控制台自动计算）

2. 记下 OIDC Provider 的 ARN，格式：
   ```
   acs:ram::<账号ID>:oidc-provider/GitHubActions
   ```

---

## 使用示例

### 基础用法

```hcl
module "github_oidc_role" {
  source            = "../modules/github-oidc-role"
  role_name         = "agenthive-cloud-github-actions-role"
  github_repo       = "sdoxiaobaomei/agenthive-cloud"
  oidc_provider_arn = "acs:ram::1261729158179509:oidc-provider/GitHubActions"
  aliyun_account_id = "1261729158179509"
  oss_bucket_name   = "agenthive-terraform-state"
}

output "role_arn" {
  value = module.github_oidc_role.role_arn
}
```

### 严格分支控制

```hcl
module "github_oidc_role" {
  source            = "../modules/github-oidc-role"
  role_name         = "agenthive-cloud-prod-role"
  github_repo       = "sdoxiaobaomei/agenthive-cloud"
  oidc_provider_arn = alicloud_ram_oidc_provider.github.arn
  aliyun_account_id = var.account_id

  # 只允许 main 分支 + prod environment
  allowed_branches     = ["main"]
  allowed_environments = ["prod"]
  allow_pull_request   = false   # PR 不能操作生产环境
  allow_workflow_dispatch = true
}
```

### 限制地域

```hcl
module "github_oidc_role" {
  source            = "../modules/github-oidc-role"
  role_name         = "agenthive-cloud-role"
  github_repo       = "sdoxiaobaomei/agenthive-cloud"
  oidc_provider_arn = alicloud_ram_oidc_provider.github.arn
  aliyun_account_id = var.account_id
  region            = "cn-beijing"   # 只允许操作北京地域
}
```

---

## 完整 OIDC 配置流程

### 步骤 1：阿里云侧 — 创建 OIDC Provider（一次性）

控制台路径：**RAM → 身份提供商 → OIDC → 创建**

| 字段 | 值 |
|------|-----|
| 身份提供商名称 | `GitHubActions` |
| Issuer URL | `https://token.actions.githubusercontent.com` |
| 指纹 | 点击"获取指纹"自动计算 |
| 客户端 ID | `sts.aliyuncs.com` |
| 最早颁发时间限制 | 12（默认） |

或 Terraform：

```hcl
resource "alicloud_ram_oidc_provider" "github" {
  oid_provider_name = "GitHubActions"
  issuer_url        = "https://token.actions.githubusercontent.com"
  client_ids        = jsonencode(["sts.aliyuncs.com"])
  fingerprints      = jsonencode(["自动获取的指纹值"])
  description       = "GitHub Actions OIDC"
}
```

### 步骤 2：本模块创建 RAM 角色

```bash
cd iac/alicloud/terraform/bootstrap
terraform init
terraform apply
```

输出 `role_arn`，如：
```
acs:ram::1261729158179509:role/agenthive-cloud-github-actions-role
```

### 步骤 3：GitHub 仓库侧 — 配置 Secrets

进入仓库 **Settings → Secrets and variables → Actions → Repository secrets**：

| Secret | 值 |
|--------|-----|
| `ALIYUN_ACCOUNT_ID` | `1261729158179509` |
| `ALIYUN_ROLE_ARN` | `acs:ram::1261729158179509:role/agenthive-cloud-github-actions-role` |

**删除旧的 Secrets**（如果存在）：
- `ALIYUN_ACCESS_KEY_ID` ← 删
- `ALIYUN_ACCESS_KEY_SECRET` ← 删

### 步骤 4：修改 GitHub Actions 工作流

在每个需要访问阿里云的工作流中，增加 OIDC 权限配置：

```yaml
permissions:
  id-token: write    # 必须！允许获取 OIDC JWT
  contents: read

jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4

      # 获取阿里云临时凭证
      - name: Configure Aliyun Credentials
        run: |
          TOKEN=$(curl -s -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.aliyuncs.com" | jq -r '.value')

          CREDS=$(aliyun sts AssumeRoleWithOIDC \
            --OIDCProviderArn "acs:ram::${{ secrets.ALIYUN_ACCOUNT_ID }}:oidc-provider/GitHubActions" \
            --RoleArn "${{ secrets.ALIYUN_ROLE_ARN }}" \
            --OIDCToken "$TOKEN" \
            --RoleSessionName "github-${{ github.run_id }}")

          echo "ALICLOUD_ACCESS_KEY=$(echo $CREDS | jq -r '.Credentials.AccessKeyId')" >> $GITHUB_ENV
          echo "ALICLOUD_SECRET_KEY=$(echo $CREDS | jq -r '.Credentials.AccessKeySecret')" >> $GITHUB_ENV
          echo "ALICLOUD_SECURITY_TOKEN=$(echo $CREDS | jq -r '.Credentials.SecurityToken')" >> $GITHUB_ENV
```

---

## 输入变量

| 变量 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `role_name` | `string` | ✅ | — | RAM 角色名称 |
| `github_repo` | `string` | ✅ | — | GitHub 仓库全名，如 `org/repo` |
| `oidc_provider_arn` | `string` | ✅ | — | OIDC Provider ARN |
| `aliyun_account_id` | `string` | ✅ | — | 阿里云账号 ID（16 位） |
| `allowed_branches` | `list(string)` | ❌ | `["main"]` | 允许触发的分支 |
| `allowed_environments` | `list(string)` | ❌ | `["dev","staging","prod"]` | 允许触发的 Environment |
| `allow_pull_request` | `bool` | ❌ | `true` | 是否允许 PR 触发 |
| `allow_workflow_dispatch` | `bool` | ❌ | `true` | 是否允许手动触发 |
| `permissions` | `object` | ❌ | 全部 `true` | 各服务权限开关 |
| `oss_bucket_name` | `string` | ❌ | `"*"` | State Bucket 名称（精确限制 OSS） |
| `region` | `string` | ❌ | `"*"` | 限制操作地域 |
| `tags` | `map(string)` | ❌ | 见代码 | 角色标签 |

### `permissions` 对象结构

```hcl
permissions = {
  vpc = true   # VPC / VSwitch / NAT / EIP
  ecs = true   # ECS 实例（ACK 节点）
  cs  = true   # ACK 容器服务
  slb = true   # 负载均衡
  log = true   # SLS 日志服务
  oss = true   # 对象存储（backend）
  ram = true   # RAM 只读
  tag = true   # 全局标签
}
```

---

## 输出

| 输出 | 类型 | 说明 |
|------|------|------|
| `role_arn` | `string` | 角色 ARN，写入 GitHub Secrets |
| `role_name` | `string` | 角色名称 |
| `trust_policy_document` | `string` | 生效的信任策略 JSON |
| `custom_policy_name` | `string` | 自定义策略名称 |

---

## 权限策略说明

本模块基于 AgentHive Cloud **实际使用的资源类型**构建最小权限策略：

| 服务 | Action 数量 | 覆盖资源 |
|------|-------------|----------|
| VPC | ~20 | VPC、VSwitch、NAT、EIP、SNAT、路由表 |
| ECS | ~30 | 实例、云盘、安全组、KeyPair |
| CS | ~25 | ACK 集群、节点池、Addon、Kubeconfig |
| SLB | ~10 | 负载均衡（ACK API Server 入口） |
| Log | ~20 | SLS Project/LogStore（ACK 自动创建） |
| OSS | ~7 | Terraform State 读写 |
| RAM | 1 | GetRole 只读 |
| Tag | 3 | 全局标签操作 |

### 遇到权限不足怎么办？

```bash
# 1. 在阿里云控制台 → RAM → 角色 → 找到你的角色
# 2. 临时附加对应服务的系统策略（如 AliyunCSFullAccess）
# 3. 重新运行 GitHub Actions，看报错消失
# 4. 在 ActionTrail 中搜索缺失的 Action
# 5. 回到本模块补充 Action，重新 apply
# 6. 撤销临时系统策略
```

---

## 安全建议

1. **永远不要给 OIDC 角色 AliyunRAMFullAccess** —— 否则 workflow 可以给自己授权，突破所有限制
2. **PR 和 Apply 分离** —— Plan 用低权限角色，Apply 用高权限角色，通过 `allow_pull_request` 控制
3. **分支级隔离** —— `main` 分支才能操作生产环境，feature 分支只能 plan
4. **定期审计** —— 通过 ActionTrail 检查 `sourceIdentity` 字段，确认所有操作可追溯
