# 阿里云多环境管理场景
# 使用 Terraform Workspace 实现 dev/staging/prod 隔离
# 最后更新: 2026-04-16
# Provider: aliyun/alicloud 1.275.0

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "1.275.0"
    }
  }
  backend "oss" {
    bucket              = "agenthive-terraform-state"
    prefix              = "envs"
    region              = "cn-beijing"
    tablestore_endpoint = "https://agenthive-locks.cn-beijing.ots.aliyuncs.com"
    tablestore_table    = "terraform_locks"
  }
}

provider "alicloud" {
  region = var.region
}

locals {
  env_config = {
    # default 用于未指定 workspace 时的兜底，采用最小规格
    default = {
      instance_type = "ecs.t6-c1m1.large"
      node_count    = 1
      disk_size     = 40
    }
    # dev: 开发环境，2 节点，与 default 区分以验证 workspace 切换生效
    dev = {
      instance_type = "ecs.t6-c1m1.large"
      node_count    = 2
      disk_size     = 40
    }
    staging = {
      instance_type = "ecs.g7.xlarge"
      node_count    = 3
      disk_size     = 100
    }
    prod = {
      instance_type = "ecs.g7.2xlarge"
      node_count    = 5
      disk_size     = 200
    }
  }
  current = local.env_config[terraform.workspace]
}

resource "alicloud_vpc" "main" {
  vpc_name   = "${var.project_name}-${terraform.workspace}-vpc"
  cidr_block = "10.0.0.0/16"
  tags = {
    Environment = terraform.workspace
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

resource "alicloud_vswitch" "main" {
  vpc_id     = alicloud_vpc.main.id
  cidr_block = "10.0.1.0/24"
  zone_id    = "${var.region}-a"
  tags = {
    Environment = terraform.workspace
    Project     = var.project_name
  }
}

resource "alicloud_security_group" "main" {
  security_group_name = "${var.project_name}-${terraform.workspace}-sg"
  vpc_id              = alicloud_vpc.main.id
  tags = {
    Environment = terraform.workspace
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# 模拟环境差异化配置: ECS 实例规格和数量随环境变化
resource "alicloud_instance" "app" {
  count                = local.current.node_count
  instance_name        = "${var.project_name}-${terraform.workspace}-app-${count.index + 1}"
  instance_type        = local.current.instance_type
  image_id             = "ubuntu_22_04_x64_20G_alibase_20240530.vhd"
  vswitch_id           = alicloud_vswitch.main.id
  security_groups      = [alicloud_security_group.main.id]
  system_disk_category = "cloud_essd"
  system_disk_size     = local.current.disk_size
  tags = {
    Environment = terraform.workspace
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}
