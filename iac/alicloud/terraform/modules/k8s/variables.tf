variable "project_name" {
  description = "项目名称，用于资源命名前缀"
  type        = string
}

variable "cluster_name" {
  description = "ACK 集群名称"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vswitch_ids" {
  description = "VSwitch ID 列表，集群将部署在这些子网中"
  type        = list(string)
}

variable "service_cidr" {
  description = "K8s Service 网段"
  type        = string
  default     = "172.21.0.0/20"
}

variable "pod_cidr" {
  description = "K8s Pod 网段"
  type        = string
  default     = "172.20.0.0/16"
}

variable "worker_instance_types" {
  description = "Worker 节点实例规格列表"
  type        = list(string)
  default     = ["ecs.u2a-c1m1.xlarge"]
}

variable "worker_desired_size" {
  description = "Worker 节点数量"
  type        = number
  default     = 1
}

variable "worker_disk_size" {
  description = "Worker 节点系统盘大小（GB）"
  type        = number
  default     = 40
}

variable "deletion_protection" {
  description = "是否开启删除保护"
  type        = bool
  default     = false
}

variable "environment" {
  description = "环境标识"
  type        = string
  default     = "dev"
}
