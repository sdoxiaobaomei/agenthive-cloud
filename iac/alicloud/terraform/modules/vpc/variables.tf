variable "project_name" {
  description = "项目名称，用于资源命名前缀"
  type        = string
}

variable "region" {
  description = "阿里云地域 ID"
  type        = string
  default     = "cn-beijing"
}

variable "vpc_cidr" {
  description = "VPC 网段，如 172.16.0.0/16"
  type        = string
  default     = "172.16.0.0/16"
}

variable "zone_ids" {
  description = "可用区列表，每个可用区对应一个 VSwitch"
  type        = list(string)
}

variable "vswitch_cidrs" {
  description = "VSwitch 网段列表，必须与 zone_ids 一一对应"
  type        = list(string)
}

variable "environment" {
  description = "环境标识，如 dev / staging / prod"
  type        = string
  default     = "dev"
}

variable "nat_bandwidth" {
  description = "NAT 网关 EIP 带宽上限（Mbps）"
  type        = number
  default     = 10
}
