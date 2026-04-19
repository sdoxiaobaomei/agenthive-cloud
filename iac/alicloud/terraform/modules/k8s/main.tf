# ACK/K8s 集群模块
# 职责: 创建 ACK 托管版集群 + 节点池
# 参考实现: ack-full/main.tf (第 77-148 行)

resource "alicloud_cs_managed_kubernetes" "main" {
  name                 = var.cluster_name
  vswitch_ids          = var.vswitch_ids
  new_nat_gateway      = false
  slb_internet_enabled = true
  deletion_protection  = var.deletion_protection
  service_cidr         = var.service_cidr
  pod_cidr             = var.pod_cidr

  addons {
    name = "csi-plugin"
  }
  addons {
    name = "managed-csiprovisioner"
  }
  addons {
    name = "metrics-server"
  }
  addons {
    name = "managed-coredns"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

resource "alicloud_cs_kubernetes_node_pool" "main" {
  node_pool_name       = "${var.cluster_name}-default-pool"
  cluster_id           = alicloud_cs_managed_kubernetes.main.id
  vswitch_ids          = var.vswitch_ids
  instance_types       = var.worker_instance_types
  desired_size         = var.worker_desired_size
  system_disk_category = "cloud_essd"
  system_disk_size     = var.worker_disk_size

  labels {
    key   = "environment"
    value = var.environment
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

data "alicloud_cs_cluster_credential" "main" {
  cluster_id = alicloud_cs_managed_kubernetes.main.id
}
