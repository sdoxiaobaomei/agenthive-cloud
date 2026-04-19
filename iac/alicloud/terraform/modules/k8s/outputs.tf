output "cluster_id" {
  description = "ACK 集群 ID"
  value       = alicloud_cs_managed_kubernetes.main.id
}

output "cluster_name" {
  description = "ACK 集群名称"
  value       = alicloud_cs_managed_kubernetes.main.name
}

output "kubeconfig" {
  description = "集群 kubeconfig（敏感，仅用于本地调试或 CI/CD 注入）"
  value       = data.alicloud_cs_cluster_credential.main.kube_config
  sensitive   = true
}

output "api_server_internet" {
  description = "API Server 公网端点"
  value       = alicloud_cs_managed_kubernetes.main.api_server_internet
}
