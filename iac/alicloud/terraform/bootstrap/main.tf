# ============================================================================
# Bootstrap: 创建 GitHub Actions OIDC 认证基础设施
#
# 这个配置一次性创建:
#   1. OIDC Provider (连接 GitHub Actions ↔ 阿里云 RAM)
#   2. RAM Role (GitHub Actions 扮演的目标角色)
#   3. 自定义最小权限策略
#
# 使用方式:
#   1. 复制 terraform.tfvars.example → terraform.tfvars，填入你的值
#   2. terraform init
#   3. terraform plan
#   4. terraform apply
#
# 如果 OIDC Provider 已存在（通过控制台创建过）:
#   terraform import alicloud_ram_oidc_provider.github acs:ram::<account-id>:oidc-provider/GitHubActions
# ============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = ">= 1.275.0"
    }
  }
  backend "oss" {
    bucket              = "agenthive-terraform-state"
    prefix              = "bootstrap"
    region              = "cn-beijing"
    tablestore_endpoint = "https://agenthive-locks.cn-beijing.ots.aliyuncs.com"
    tablestore_table    = "terraform_locks"
  }
}

provider "alicloud" {
  region = var.region
}

# ----------------------------------------------------------------------------
# 1. OIDC Provider
# ----------------------------------------------------------------------------
# 让阿里云信任 GitHub Actions 的 OIDC token。
# thumbprints 是 GitHub OIDC 服务端证书的 SHA-1 fingerprint。
# ----------------------------------------------------------------------------

resource "alicloud_ram_oidc_provider" "github" {
  name          = "GitHubActions"
  issuer_url    = "https://token.actions.githubusercontent.com"
  thumbprints   = var.github_oidc_thumbprints
  client_ids    = ["sts.aliyuncs.com"]
  description   = "GitHub Actions OIDC provider for ${var.github_repo}"
}

# ----------------------------------------------------------------------------
# 2. GitHub Actions RAM Role
# ----------------------------------------------------------------------------
# 使用模块创建具备最小权限的角色。
# 注意: 由于阿里云 RAM OIDC trust policy 不支持 oidc:sub 条件键，
#       模块中的 allowed_branches / allowed_environments / allow_pull_request
#       将生成 trust policy 中的 StringLike/oidc:sub 条件，但这会导致
#       AssumeRoleWithOIDC 失败。
#       当前解决方案: 在模块调用时传入空分支列表，让模块不生成 oidc:sub 条件。
#       后续如阿里云支持该条件键，可重新启用限制。
# ----------------------------------------------------------------------------

module "github_oidc_role" {
  source            = "../modules/github-oidc-role"
  role_name         = var.role_name
  github_repo       = var.github_repo
  oidc_provider_arn = alicloud_ram_oidc_provider.github.arn
  aliyun_account_id = var.aliyun_account_id
  oss_bucket_name   = var.oss_bucket_name
  region            = var.region

  # ⚠️ 当前阿里云 RAM OIDC 不支持 oidc:sub 条件键
  # 传入空列表，不在 trust policy 中包含 oidc:sub 限制
  allowed_branches      = []
  allowed_environments  = []
  allow_pull_request    = false
  allow_workflow_dispatch = true

  tags = {
    Project     = var.project_name
    Environment = "bootstrap"
    ManagedBy   = "terraform"
  }
}
