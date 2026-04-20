# GitHub OIDC 角色模块 - 输出

output "role_arn" {
  description = "创建好的 RAM 角色 ARN，需要写入目标仓库的 GitHub Secrets"
  value       = alicloud_ram_role.this.arn
}

output "role_name" {
  description = "RAM 角色名称"
  value       = alicloud_ram_role.this.name
}

output "trust_policy_document" {
  description = "最终生效的角色信任策略 JSON"
  value       = data.alicloud_ram_policy_document.trust.json
}

output "custom_policy_name" {
  description = "自定义权限策略名称"
  value       = alicloud_ram_policy.this.name
}
