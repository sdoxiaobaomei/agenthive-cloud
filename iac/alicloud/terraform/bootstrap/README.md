# Bootstrap - OIDC 认证基础设施

> 用 Terraform 管理 GitHub Actions ↔ 阿里云 的 OIDC 联邦认证基础设施。

---

## 作用

一次性创建以下资源：

| 资源 | 说明 |
|------|------|
| **OIDC Provider** | 让阿里云信任 GitHub Actions 的 OIDC Token |
| **RAM Role** | GitHub Actions 通过 `AssumeRoleWithOIDC` 扮演的目标角色 |
| **自定义权限策略** | 基于 AgentHive 实际资源类型的最小权限策略 |

---

## 前置条件

1. 阿里云账号已开通 RAM 服务
2. 已有 OSS Bucket 作为 Terraform backend（如 `agenthive-terraform-state`）
3. 已配置 TableStore 作为 state lock（或准备用本地 lock）
4. 知道阿里云账号 ID（12 位数字）

---

## 快速开始

### Step 1: 配置变量

```bash
cd iac/alicloud/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
# 编辑 terraform.tfvars，填入你的 aliyun_account_id 和 thumbprints
```

### Step 2: 初始化

```bash
terraform init
```

### Step 3: 如果 OIDC Provider 已存在（通过控制台创建）

```bash
# 导入已存在的 Provider，让 Terraform 接管管理
terraform import alicloud_ram_oidc_provider.github \
  acs:ram::<你的账号ID>:oidc-provider/GitHubActions
```

### Step 4: Plan & Apply

```bash
terraform plan
terraform apply
```

---

## 输出值

| 输出 | 用途 |
|------|------|
| `oidc_provider_arn` | 配置到 workflow 的 `oidc_provider_arn` |
| `role_arn` | 配置到 workflow 的 `role_arn` |
| `trust_policy` | 查看最终生效的信任策略 |

---

## 与 GitHub Actions 集成

apply 完成后，将输出的 `role_arn` 配置到 `.github/workflows/iac-*.yml` 中：

```yaml
config = CredConfig(
    type='oidc_role_arn',
    oidc_provider_arn='<oidc_provider_arn 输出值>',
    oidc_token_file_path='/tmp/oidc-token',
    role_arn='<role_arn 输出值>'
)
```

当前配置已硬编码，如需修改角色名或仓库，调整 `terraform.tfvars` 后重新 apply。

---

## 已知限制

**阿里云 RAM OIDC 不支持 `oidc:sub` 条件键**

当前 `github-oidc-role` 模块生成的 trust policy 中如果包含 `StringLike` / `oidc:sub` 条件，`AssumeRoleWithOIDC` 会返回 `AuthenticationFail.NoPermission` / `ImplicitDeny`。

**解决方案**: bootstrap 调用模块时传入空的 `allowed_branches`、`allowed_environments`，并设置 `allow_pull_request = false`，这样模块生成的 trust policy 只包含 `oidc:iss` + `oidc:aud` 两个条件。

后续如阿里云支持 `oidc:sub`，可在 `main.tf` 中重新启用限制：
```hcl
allowed_branches      = ["main", "demo-ask"]
allowed_environments  = ["production"]
allow_pull_request    = true
```

---

## 安全建议

1. **不要把这个目录的 state 和 prod 环境的 state 放在同一个 prefix 下**
2. **bootstrap 完成后，给阿里云账号开启 MFA**
3. **定期轮换 OIDC Provider 的 thumbprint**（GitHub 证书更新时）
