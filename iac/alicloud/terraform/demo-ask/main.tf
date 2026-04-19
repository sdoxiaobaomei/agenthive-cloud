# ============================================================================
# 阿里云 ASK Demo 环境 - 轻量 Serverless K8s
# ============================================================================
# 适用场景: 快速 Demo、PoC、临时测试、教学演示
# 核心特点: 无节点、创建快(~5分钟)、销毁快(~2分钟)、成本低
# ============================================================================

terraform {
  # required_version: 指定 Terraform CLI 的最低版本
  # 1.5.0+ 引入了"import block"和"check block"等稳定功能
  required_version = ">= 1.5.0"

  required_providers {
    # alicloud provider: 阿里云官方 Terraform Provider
    # source: 指定 Provider 的发布来源（Terraform Registry 上的命名空间）
    # version: 锁定 Provider 版本，避免因版本升级导致配置不兼容
    alicloud = {
      source  = "aliyun/alicloud"
      version = ">= 1.275.0"
    }
  }

  # ==========================================================
  # State 后端配置: 阿里云 OSS + OTS 锁定
  # ----------------------------------------------------------
  # 前置要求:
  #   1. 创建 OSS Bucket (如 agenthive-terraform-state)
  #   2. 创建 OTS (Table Store) 实例 (如 agenthive-locks)
  #   3. 在 OTS 实例中创建表 (如 terraform_locks，OTS 表名只允许字母/数字/下划线)
  #
  # 创建命令:
  #   aliyun oss mb oss://agenthive-terraform-state --region cn-beijing
  #   aliyun ots CreateInstance --InstanceName agenthive-lock --ClusterType SSD
  #   aliyun ots CreateTable --InstanceName agenthive-lock --TableMeta '{"TableName":"terraform_locks","PrimaryKey":[{"Name":"LockID","Type":"STRING"}]}'
  #
  # 注意: Terraform backend 不支持变量，以下 bucket/endpoint 需手动替换为实际值
  # ==========================================================
  backend "oss" {
    bucket              = "agenthive-terraform-state"
    prefix              = "demo-ask"
    region              = "cn-beijing"
    tablestore_endpoint = "https://agenthive-locks.cn-beijing.ots.aliyuncs.com"
    tablestore_table    = "terraform_locks"
  }
}

# ----------------------------------------------------------------------------
# provider "alicloud": 配置阿里云连接参数
# ----------------------------------------------------------------------------
# region: 阿里云地域 ID，决定资源创建在哪个数据中心
# 可选值: cn-beijing, cn-shanghai, cn-hangzhou, cn-shenzhen 等
# 地域列表参考: https://help.aliyun.com/document_detail/40654.html
provider "alicloud" {
  region = var.region
}

# ============================================================================
# 第一层: 网络基础设施 (VPC + VSwitch + NAT)
# ============================================================================
# VPC (Virtual Private Cloud) 是你的私有网络边界。
# 所有云资源必须放在某个 VPC 内，它们之间通过私有 IP 通信。
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# resource "alicloud_vpc" "demo": 创建专有网络
# ----------------------------------------------------------------------------
# vpc_name: VPC 的显示名称，建议带上项目前缀，方便在控制台识别
# cidr_block: VPC 的网段，采用 CIDR 表示法。
#   172.16.0.0/16 表示可用 IP 范围是 172.16.0.0 ~ 172.16.255.255（约 65536 个 IP）
#   选择 172.16.x.x 是因为它与阿里云默认网段不冲突，也便于记忆。
# tags: 资源的标签，用于分类、计费归集、权限控制等。
#   Environment=demo: 标识这是演示环境，避免被误认为生产环境
#   ManagedBy=terraform: 表明此资源由 Terraform 管理，不要手动修改
#   AutoCleanup=true: 自定义标签，提示这是一个可以安全清理的资源
resource "alicloud_vpc" "demo" {
  vpc_name   = "${var.project_name}-demo-vpc"
  cidr_block = "172.16.0.0/16"
  tags = {
    Environment = "demo"
    Project     = var.project_name
    ManagedBy   = "terraform"
    AutoCleanup = "true"
  }
}

# ----------------------------------------------------------------------------
# resource "alicloud_vswitch" "demo": 创建虚拟交换机
# ----------------------------------------------------------------------------
# VSwitch 是 VPC 内的子网划分单元，每个 VSwitch 绑定一个可用区(Zone)。
# 同一个 VPC 内，不同可用区的 VSwitch 之间默认互通。
#
# vpc_id: 绑定到上面创建的 VPC
# cidr_block: 子网网段，必须是 VPC 网段的子集。
#   172.16.1.0/24 表示可用 IP 范围是 172.16.1.0 ~ 172.16.1.255（256 个 IP）
# zone_id: 可用区 ID，资源实际部署的物理位置。
#   ASK Serverless 只需要一个可用区即可工作，简化配置。
#   可用区格式: {region}-{letter}，如 cn-beijing-a
# vswitch_name: 交换机名称
resource "alicloud_vswitch" "demo" {
  vpc_id       = alicloud_vpc.demo.id
  cidr_block   = "172.16.1.0/24"
  zone_id      = var.zone_id
  vswitch_name = "${var.project_name}-demo-vswitch"
  tags = {
    Environment = "demo"
    Project     = var.project_name
  }
}

# ----------------------------------------------------------------------------
# resource "alicloud_nat_gateway" "demo": 创建 NAT 网关
# ----------------------------------------------------------------------------
# NAT 网关的作用: 让 VPC 内没有公网 IP 的资源（如 ASK Pod）能够访问公网。
# 类比: 公司内网通过路由器共享一条宽带上网。
#
# vpc_id: 绑定到 VPC
# nat_gateway_name: 网关名称
# payment_type: 计费方式
#   "PayAsYouGo" = 按量付费（适合临时 Demo）
#   "Subscription" = 包年包月（适合长期运行）
# vswitch_id: NAT 网关部署在哪个交换机（必须选有公网访问能力的交换机）
# nat_type: NAT 网关类型
#   "Enhanced" = 增强型（性能更好，新规格，推荐）
#   "Normal" = 普通型（旧规格）
resource "alicloud_nat_gateway" "demo" {
  vpc_id           = alicloud_vpc.demo.id
  nat_gateway_name = "${var.project_name}-demo-nat"
  payment_type     = "PayAsYouGo"
  vswitch_id       = alicloud_vswitch.demo.id
  nat_type         = "Enhanced"
}

# ----------------------------------------------------------------------------
# resource "alicloud_eip_address" "demo": 创建弹性公网 IP
# ----------------------------------------------------------------------------
# EIP 是一个独立的公网 IP 地址资源。
# NAT 网关需要一个公网 IP 才能将内网流量转发到公网。
#
# address_name: EIP 的名称
# isp: 运营商类型
#   "BGP" = 多线 BGP（推荐，覆盖三大运营商）
# internet_charge_type: 公网计费方式
#   "PayAsYouGo" = 按量付费（按实际流量计费，适合低流量 Demo）
#   "Subscription" = 包年包月带宽
# bandwidth: 带宽上限（Mbps），仅影响峰值，按量付费按实际使用流量计费
resource "alicloud_eip_address" "demo" {
  address_name         = "${var.project_name}-demo-eip"
  isp                  = "BGP"
  internet_charge_type = "PayByTraffic"
  bandwidth            = 10
}

# ----------------------------------------------------------------------------
# resource "alicloud_eip_association" "demo": 将 EIP 绑定到 NAT 网关
# ----------------------------------------------------------------------------
# allocation_id: 要绑定的 EIP ID（引用上面的 eip_address 资源）
# instance_id: 要绑定到的目标实例（这里是 NAT 网关的 ID）
resource "alicloud_eip_association" "demo" {
  allocation_id = alicloud_eip_address.demo.id
  instance_id   = alicloud_nat_gateway.demo.id
}

# ----------------------------------------------------------------------------
# resource "alicloud_snat_entry" "demo": 创建 SNAT 条目
# ----------------------------------------------------------------------------
# SNAT (Source Network Address Translation): 源地址转换。
# 作用: 将内网源 IP 转换为公网 IP，使得内网资源可以主动访问公网。
# 没有 SNAT，Pod 就无法拉取 Docker Hub 镜像或访问外部 API。
#
# snat_table_id: SNAT 表 ID（NAT 网关自动创建，通过属性引用）
# source_vswitch_id: 哪些 VSwitch 内的资源可以使用此 SNAT（即允许出网的网段）
# snat_ip: 用于 NAT 转换的公网 IP 地址（引用上面创建的 EIP）
resource "alicloud_snat_entry" "demo" {
  snat_table_id     = alicloud_nat_gateway.demo.snat_table_ids
  source_vswitch_id = alicloud_vswitch.demo.id
  snat_ip           = alicloud_eip_address.demo.ip_address
}

# ============================================================================
# 第二层: 容器集群 (ACK - 托管版 Kubernetes)
# ============================================================================
# ACK Managed Kubernetes 是阿里云提供的托管版 K8s 集群，核心特点是：
#   - 控制平面由阿里云托管和运维，用户无需管理 Master 节点
#   - Worker 节点通过独立的 node_pool 资源管理
#   - 支持完整的 K8s 特性（DaemonSet、HostPath 等）
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# resource "alicloud_cs_managed_kubernetes" "demo": 创建 ACK 托管版集群
# ----------------------------------------------------------------------------
# name: 集群名称，在 ACK 控制台显示
#
# vpc_id: 集群所属的 VPC
#
# vswitch_ids: 集群使用的交换机列表（数组形式）。
#   本 Demo 使用单可用区 + 单节点，简化配置和学习成本。
#
# new_nat_gateway: 是否为集群自动创建 NAT 网关
#   false = 使用上面手动创建的 NAT（推荐，资源统一管理）
#   true = 自动创建（方便但不易管理）
#
# slb_internet_enabled: 是否开启公网 API Server 访问
#   true = 可以通过公网 kubectl 连接集群（Demo 必需）
#   false = 仅内网访问（更安全，但需要跳板机）
#
# deletion_protection: 删除保护
#   false = 允许通过 terraform destroy 删除（Demo 需要）
#   true = 禁止删除（生产环境建议开启，防止误删）
#
# kube_config: 是否自动生成 kubeconfig 文件内容
#   true = 资源创建后自动输出 kubeconfig 字符串
#   配合 output 可以导出为文件供 kubectl 使用
#
# addons: 集群插件（核心系统组件）
#   csi-plugin: 容器存储接口插件，支持挂载云盘/NAS/OSS
#   managed-csiprovisioner: CSI 动态存储供应器，支持 PVC 自动创建存储
#   metrics-server: 集群指标采集，支持 kubectl top / HPA 等
# Basic ACK cluster (no CSK Pro required)
# Trade-off: Uses 1 small ECS worker node (~$15/month) instead of serverless ASK
resource "alicloud_cs_managed_kubernetes" "demo" {
  name                 = "${var.project_name}-demo-ask"
  vswitch_ids          = [alicloud_vswitch.demo.id]
  new_nat_gateway      = false
  slb_internet_enabled = true
  deletion_protection  = false
  service_cidr         = "172.21.0.0/20"
  pod_cidr             = "172.20.0.0/16"

  addons {
    name = "csi-plugin"
  }
  addons {
    name = "managed-csiprovisioner"
  }
  addons {
    name = "metrics-server"
  }

  tags = {
    Environment = "demo"
    Project     = var.project_name
    ManagedBy   = "terraform"
    AutoCleanup = "true"
  }
}

# Worker node pool (required for basic ACK — provider v1.212.0+ uses separate resource)
resource "alicloud_cs_kubernetes_node_pool" "demo" {
  node_pool_name       = "${var.project_name}-demo-pool"
  cluster_id           = alicloud_cs_managed_kubernetes.demo.id
  vswitch_ids          = [alicloud_vswitch.demo.id]
  instance_types       = ["ecs.ic5.xlarge"] # 4 vCPU / 4 GB，计算型，当前区域可用
  desired_size         = 1
  system_disk_category = "cloud_essd" # cn-beijing-l 等新区主要支持 ESSD
  system_disk_size     = 40
  instance_charge_type = "PostPaid" # 按量付费，用多少付多少
}

# ----------------------------------------------------------------------------
# data "alicloud_cs_cluster_credential" "demo": 查询集群凭证数据源
# ----------------------------------------------------------------------------
# data 资源用于"读取"已存在的数据，而不是"创建"新资源。
# 这里通过数据源获取集群的 kubeconfig、证书等连接信息。
#
# cluster_id: 目标集群的 ID（引用上面创建的 ASK 集群）
# 获取的信息包括: kubeconfig、client_certificate、client_key、cluster_ca_certificate 等
# 常用于: 将 kubeconfig 输出到文件，供本地 kubectl 或 CI/CD 使用
data "alicloud_cs_cluster_credential" "demo" {
  cluster_id = alicloud_cs_managed_kubernetes.demo.id
}

# ============================================================================
# 权限说明 (README)
# ============================================================================
# 本 Terraform 栈遵循"基础设施与权限分离"原则，不管理 RAM 用户或权限。
#
# 运行本 Terraform 所需的 RAM 用户必须预先通过阿里云控制台手动附加以下
# 系统策略（一次性配置）：
#   - AliyunVPCFullAccess   : VPC、VSwitch、NAT、安全组
#   - AliyunCSFullAccess    : 容器服务 ACK/ASK
#   - AliyunSLBFullAccess   : 负载均衡（K8s API Server 公网入口）
#   - AliyunLogFullAccess   : 日志服务 SLS（ACK 默认启用）
#
# 为什么不用 Terraform 管理权限？
#   1. 安全隔离：基础设施代码不应具备修改 IAM 的权限（最小权限原则）
#   2. 避免循环依赖：低权限用户无法为其他用户授权
#   3. 行业惯例：IAM 由平台/安全团队单独管理（参考 AWS Landing Zone / 阿里云资源目录）
#
# 未来演进方向：
#   - 团队规模扩大后，将 IAM 配置提取到独立的 iac/platform-iam/ 仓库
#   - 使用 CloudSSO / SAML 替代 RAM 用户 AccessKey
#   - Terraform 通过 AssumeRole + OIDC 获取临时凭证（无长期 AccessKey）
# ============================================================================
