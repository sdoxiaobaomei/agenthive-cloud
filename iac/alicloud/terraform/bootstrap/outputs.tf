# ============================================================================
# Bootstrap Outputs
# ============================================================================

output "oidc_provider_arn" {
  description = "OIDC Provider ARN"
  value       = alicloud_ram_oidc_provider.github.arn
}

output "role_arn" {
  description = "GitHub Actions RAM 角色 ARN，需要配置到 workflow 中"
  value       = module.github_oidc_role.role_arn
}

output "role_name" {
  description = "RAM 角色名称"
  value       = module.github_oidc_role.role_name
}

output "trust_policy" {
  description = "最终生效的信任策略 JSON"
  value       = module.github_oidc_role.trust_policy_document
}
