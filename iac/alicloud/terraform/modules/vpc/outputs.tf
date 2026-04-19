output "vpc_id" {
  description = "VPC ID"
  value       = alicloud_vpc.main.id
}

output "vswitch_ids" {
  description = "VSwitch ID 列表"
  value       = alicloud_vswitch.main[*].id
}

output "nat_gateway_id" {
  description = "NAT 网关 ID"
  value       = alicloud_nat_gateway.main.id
}
