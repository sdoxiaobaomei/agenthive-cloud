# ============================================================================
# Bootstrap Variables
# ============================================================================

variable "region" {
  description = "阿里云地域"
  type        = string
  default     = "cn-beijing"
}

variable "project_name" {
  description = "项目名称，用于资源标签"
  type        = string
  default     = "agenthive"
}

variable "github_repo" {
  description = "GitHub 仓库全名，格式: owner/repo"
  type        = string
  default     = "sdoxiaobaomei/agenthive-cloud"
}

variable "aliyun_account_id" {
  description = "阿里云账号 ID"
  type        = string
}

variable "role_name" {
  description = "GitHub Actions RAM 角色名称"
  type        = string
  default     = "agenthive-cloud-github-actions-role"
}

variable "oss_bucket_name" {
  description = "Terraform State 所在的 OSS Bucket 名称（用于限制 OSS 权限范围）"
  type        = string
  default     = "agenthive-terraform-state"
}

variable "github_oidc_thumbprints" {
  description = "GitHub Actions OIDC Provider 的证书 thumbprints（SHA-1，去掉冒号）"
  type        = list(string)
}
