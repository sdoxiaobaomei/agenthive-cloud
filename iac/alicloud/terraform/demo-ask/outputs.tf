# ============================================================================
# ACK Demo 环境 - 输出定义
# ============================================================================
# output 的作用: 在 terraform apply 完成后，将关键信息展示给用户。
# 这些信息可以直接复制使用，或传递给其他工具/脚本。
#
# 常用场景:
#   - 输出 IP 地址、连接字符串等
#   - 输出 kubeconfig 供 kubectl 使用
#   - 作为模块(module)的返回值，供上级模块引用
# ============================================================================

# ----------------------------------------------------------------------------
# output "cluster_id": 集群唯一标识符
# ----------------------------------------------------------------------------
# description: 输出项的说明
# value: 输出的具体值（引用资源的属性）
#
# alicloud_cs_managed_kubernetes.demo.id:
#   这是 Terraform 的"资源引用"语法: {资源类型}.{资源名}.{属性}
#   在 apply 完成后，Terraform 会从阿里云 API 获取实际的集群 ID
# 用途:
#   - 在阿里云控制台搜索集群
#   - 其他 Terraform 模块引用此集群
#   - 脚本中执行 kubectl config use-context 等操作
output "cluster_id" {
  description = "ACK 集群的唯一 ID（如 c123456789abcdef0）"
  value       = alicloud_cs_managed_kubernetes.demo.id
}

# ----------------------------------------------------------------------------
# output "cluster_name": 集群显示名称
# ----------------------------------------------------------------------------
# 与 cluster_id 的区别:
#   - cluster_id: 阿里云分配的唯一标识（不可变）
#   - cluster_name: 你定义的显示名称（可读性强）
output "cluster_name" {
  description = "ACK 集群的显示名称"
  value       = alicloud_cs_managed_kubernetes.demo.name
}

# ----------------------------------------------------------------------------
# output "vpc_id": VPC 网络 ID
# ----------------------------------------------------------------------------
output "vpc_id" {
  description = "VPC 网络的唯一 ID"
  value       = alicloud_vpc.demo.id
}

# ----------------------------------------------------------------------------
# output "vswitch_id": 虚拟交换机 ID
# ----------------------------------------------------------------------------
output "vswitch_id" {
  description = "VSwitch 的唯一 ID"
  value       = alicloud_vswitch.demo.id
}

# ----------------------------------------------------------------------------
# output "kubeconfig_raw": kubeconfig 文件内容
# ----------------------------------------------------------------------------
# kubeconfig 是 kubectl 连接 K8s 集群的认证配置文件。
# 它包含了: 集群地址、CA 证书、用户凭证（client 证书或 token）。
#
# sensitive = true:
#   标记此输出包含敏感信息（证书、私钥等）。
#   Terraform 在 apply 输出中会将此值显示为 "<sensitive>"，避免泄露。
#   但 terraform output -raw kubeconfig_raw 仍然可以查看完整内容。
output "kubeconfig_raw" {
  description = "kubeconfig 完整内容（供 kubectl 使用）"
  value       = data.alicloud_cs_cluster_credential.demo.kube_config
  sensitive   = true
}

# ----------------------------------------------------------------------------
# output "kubeconfig_file_path": kubeconfig 文件保存路径
# ----------------------------------------------------------------------------
# path.module: Terraform 内置变量，表示当前 .tf 文件所在的目录路径。
# 使用 ${path.module} 可以确保路径相对于配置文件位置，不依赖执行目录。
output "kubeconfig_file_path" {
  description = "kubeconfig 文件将保存到的本地路径"
  value       = "${path.module}/kubeconfig-demo"
}

# ----------------------------------------------------------------------------
# output "destroy_command": 销毁命令提示
# ----------------------------------------------------------------------------
# 这是一个纯文本输出，方便用户快速知道如何清理资源。
# 实际销毁时，建议先执行 terraform plan -destroy 确认变更范围。
output "destroy_command" {
  description = "一键销毁所有资源的命令"
  value       = "cd ${path.module} && terraform destroy"
}
