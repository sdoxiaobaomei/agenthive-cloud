# GitHub OIDC 角色模块 - 变量定义
# 参考: https://help.aliyun.com/zh/ram/user-guide/create-an-oidc-identity-provider

variable "role_name" {
  description = "RAM 角色名称，如 agenthive-cloud-github-actions-role"
  type        = string
}

variable "github_repo" {
  description = "GitHub 仓库全名，格式: org/repo，如 sdoxiaobaomei/agenthive-cloud"
  type        = string
}

variable "oidc_provider_arn" {
  description = "OIDC 身份提供商 ARN，如 acs:ram::账号ID:oidc-provider/GitHubActions"
  type        = string
}

variable "aliyun_account_id" {
  description = "阿里云账号 ID（16 位数字）"
  type        = string
}

variable "allowed_branches" {
  description = "允许触发 workflow 的分支，默认只允许 main"
  type        = list(string)
  default     = ["main"]
}

variable "allowed_environments" {
  description = "允许通过 environment 触发的环境名，空列表表示不允许"
  type        = list(string)
  default     = ["dev", "staging", "prod"]
}

variable "allow_pull_request" {
  description = "是否允许 Pull Request 触发的工作流扮演此角色（用于 terraform plan）"
  type        = bool
  default     = true
}

variable "allow_workflow_dispatch" {
  description = "是否允许 workflow_dispatch（手动触发）扮演此角色"
  type        = bool
  default     = true
}

variable "permissions" {
  description = "权限配置开关，按需启用"
  type = object({
    vpc    = optional(bool, true)
    ecs    = optional(bool, true)
    cs     = optional(bool, true)
    slb    = optional(bool, true)
    log    = optional(bool, true)
    oss    = optional(bool, true)
    ram    = optional(bool, true)
    tag    = optional(bool, true)
  })
  default = {}
}

variable "oss_bucket_name" {
  description = "Terraform State 所在的 OSS Bucket 名称（用于精确限制 OSS 权限）"
  type        = string
  default     = "*"
}

variable "region" {
  description = "允许操作的地域，默认不限制"
  type        = string
  default     = "*"
}

variable "tags" {
  description = "角色的标签"
  type        = map(string)
  default = {
    ManagedBy = "terraform"
    Purpose   = "github-actions-oidc"
  }
}
