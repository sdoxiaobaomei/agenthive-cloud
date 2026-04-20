# ============================================================================
# GitHub OIDC 角色模块
# 职责: 为 GitHub Actions 创建具备最小权限的 RAM 角色
#
# 使用方式:
#   module "github_oidc_role" {
#     source            = "../modules/github-oidc-role"
#     role_name         = "agenthive-cloud-github-actions-role"
#     github_repo       = "sdoxiaobaomei/agenthive-cloud"
#     oidc_provider_arn = alicloud_ram_oidc_provider.github.arn
#     aliyun_account_id = "1261729158179509"
#     oss_bucket_name   = "agenthive-terraform-state"
#   }
# ============================================================================

locals {
  # 构建信任策略中允许的 sub 列表
  # PR 触发
  sub_pr = var.allow_pull_request ? ["repo:${var.github_repo}:pull_request"] : []

  # workflow_dispatch 在分支上触发
  sub_branches = var.allow_workflow_dispatch ? [
    for b in var.allowed_branches : "repo:${var.github_repo}:ref:refs/heads/${b}"
  ] : []

  # environment 触发
  sub_envs = length(var.allowed_environments) > 0 ? [
    for e in var.allowed_environments : "repo:${var.github_repo}:environment:${e}"
  ] : []

  allowed_subjects = concat(local.sub_pr, local.sub_branches, local.sub_envs)

  # 权限开关（使用 defaults 合并）
  perm_vpc = var.permissions.vpc != null ? var.permissions.vpc : true
  perm_ecs = var.permissions.ecs != null ? var.permissions.ecs : true
  perm_cs  = var.permissions.cs != null ? var.permissions.cs : true
  perm_slb = var.permissions.slb != null ? var.permissions.slb : true
  perm_log = var.permissions.log != null ? var.permissions.log : true
  perm_oss = var.permissions.oss != null ? var.permissions.oss : true
  perm_ram = var.permissions.ram != null ? var.permissions.ram : true
  perm_tag = var.permissions.tag != null ? var.permissions.tag : true

  # 地域条件
  region_condition = var.region != "*" ? {
    StringEquals = {
      "acs:Region" = var.region
    }
  } : {}
}

# ----------------------------------------------------------------------------
# 1. 角色信任策略 (Trust Policy)
# ----------------------------------------------------------------------------
# 谁可以扮演这个角色：只有指定的 GitHub 仓库 + 分支/PR/Environment
# ----------------------------------------------------------------------------

locals {
  trust_policy = {
    Version = "1"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Federated = [var.oidc_provider_arn]
        }
        Condition = {
          StringEquals = {
            "oidc:iss" = "https://token.actions.githubusercontent.com"
            "oidc:aud" = "sts.aliyuncs.com"
          }
          StringLike = {
            "oidc:sub" = local.allowed_subjects
          }
        }
      }
    ]
  }
}

resource "alicloud_ram_role" "this" {
  name     = var.role_name
  document = jsonencode(local.trust_policy)
  comments = "GitHub Actions OIDC role for ${var.github_repo}"
}

# ----------------------------------------------------------------------------
# 2. 自定义权限策略 (Custom Policy)
# ----------------------------------------------------------------------------
# 基于 AgentHive Cloud 实际使用的资源类型构建的最小权限策略。
#
# 资源覆盖范围:
#   - VPC / VSwitch / NAT / EIP / SNAT
#   - ECS (ACK 节点池需要创建/管理实例)
#   - CS  (ACK 容器服务)
#   - SLB (ACK 自动创建 API Server 公网 SLB)
#   - Log (ACK 自动创建 SLS 项目)
#   - OSS (Terraform backend 读写 state)
#   - RAM (GetRole 只读)
#   - Tag (全局标签操作)
#
# 注意: 如果后续增加新资源类型导致权限不足:
#       1) 临时给角色附加对应的系统策略排查
#       2) 在本模块的权限映射中补充缺失的 Action
#       3) 重新 apply 后撤销临时系统策略
# ----------------------------------------------------------------------------

locals {
  # 各服务精确 Action 映射
  actions_vpc = [
    # VPC
    "vpc:CreateVpc", "vpc:DeleteVpc", "vpc:DescribeVpcs", "vpc:ModifyVpcAttribute",
    # VSwitch
    "vpc:CreateVSwitch", "vpc:DeleteVSwitch", "vpc:DescribeVSwitches", "vpc:ModifyVSwitchAttribute",
    # NAT
    "vpc:CreateNatGateway", "vpc:DeleteNatGateway", "vpc:DescribeNatGateways", "vpc:ModifyNatGatewayAttribute",
    "vpc:CreateSnatEntry", "vpc:DeleteSnatEntry", "vpc:DescribeSnatTableEntries",
    # Route
    "vpc:DescribeRouteTables",
    # EIP
    "vpc:AllocateEipAddress", "vpc:ReleaseEipAddress", "vpc:DescribeEipAddresses",
    "vpc:AssociateEipAddress", "vpc:UnassociateEipAddress",
    "vpc:ModifyEipAddressAttribute",
    # Common
    "vpc:TagResources", "vpc:UnTagResources"
  ]

  actions_ecs = [
    # Instance lifecycle
    "ecs:RunInstances", "ecs:DeleteInstance", "ecs:DescribeInstances",
    "ecs:DescribeInstanceAttribute", "ecs:DescribeInstanceHistoryEvents",
    "ecs:StartInstance", "ecs:StopInstance", "ecs:RebootInstance",
    "ecs:ModifyInstanceAttribute", "ecs:AllocatePublicIpAddress",
    # Instance types / Images / Zones
    "ecs:DescribeInstanceTypes", "ecs:DescribeImages", "ecs:DescribeZones",
    # Disk
    "ecs:CreateDisk", "ecs:DeleteDisk", "ecs:DescribeDisks", "ecs:AttachDisk", "ecs:DetachDisk",
    "ecs:ModifyDiskAttribute",
    # Security Group
    "ecs:CreateSecurityGroup", "ecs:DeleteSecurityGroup", "ecs:DescribeSecurityGroups",
    "ecs:DescribeSecurityGroupAttribute", "ecs:DescribeSecurityGroupReferences",
    "ecs:AuthorizeSecurityGroup", "ecs:RevokeSecurityGroup",
    "ecs:AuthorizeSecurityGroupEgress", "ecs:RevokeSecurityGroupEgress",
    "ecs:JoinSecurityGroup", "ecs:LeaveSecurityGroup",
    "ecs:ModifySecurityGroupPolicy",
    # KeyPair
    "ecs:CreateKeyPair", "ecs:DeleteKeyPairs", "ecs:DescribeKeyPairs",
    # Tags
    "ecs:DescribeTags", "ecs:ListTagResources", "ecs:TagResources", "ecs:UnTagResources",
    # VPC join
    "ecs:JoinResourceGroup", "ecs:DescribeResourcesModification"
  ]

  actions_cs = [
    # Cluster
    "cs:CreateCluster", "cs:DeleteCluster", "cs:DescribeClusters", "cs:DescribeClusterDetail",
    "cs:DescribeClusterResources", "cs:DescribeClusterHosts",
    "cs:ModifyCluster", "cs:UpgradeCluster", "cs:CancelClusterUpgrade",
    "cs:DescribeUserQuota", "cs:DescribeClustersV1",
    # Node pool
    "cs:CreateClusterNodePool", "cs:DeleteClusterNodePool", "cs:DescribeClusterNodePools",
    "cs:ModifyClusterNodePool", "cs:ScaleClusterNodePool",
    "cs:DescribeClusterNodes",
    # Kubeconfig / Certs
    "cs:DescribeClusterUserKubeconfig", "cs:DescribeClusterCerts",
    # Addon
    "cs:InstallClusterAddons", "cs:UnInstallClusterAddons", "cs:DescribeClusterAddons",
    "cs:DescribeAddons", "cs:UpgradeClusterAddons",
    # Log / Monitor
    "cs:CreateClusterDiagnosis", "cs:DescribeClusterDiagnosis",
    # Tag
    "cs:ModifyClusterTags"
  ]

  actions_slb = [
    "slb:CreateLoadBalancer", "slb:DeleteLoadBalancer", "slb:DescribeLoadBalancers",
    "slb:DescribeLoadBalancerAttribute", "slb:SetLoadBalancerStatus",
    "slb:DescribeLoadBalancerListeners", "slb:CreateLoadBalancerListener", "slb:DeleteLoadBalancerListener",
    "slb:DescribeRegions", "slb:DescribeZones",
    "slb:TagResources", "slb:UnTagResources"
  ]

  actions_log = [
    "log:CreateProject", "log:DeleteProject", "log:GetProject", "log:ListProject",
    "log:CreateLogStore", "log:DeleteLogStore", "log:GetLogStore", "log:ListLogStores",
    "log:CreateIndex", "log:DeleteIndex", "log:GetIndex",
    "log:CreateConfig", "log:DeleteConfig", "log:GetConfig", "log:UpdateConfig",
    "log:CreateDashboard", "log:DeleteDashboard", "log:GetDashboard",
    "log:CreateSavedSearch", "log:DeleteSavedSearch",
    "log:ListTagResources", "log:TagResources", "log:UnTagResources"
  ]

  actions_oss = [
    "oss:GetObject", "oss:PutObject", "oss:DeleteObject",
    "oss:GetBucketInfo", "oss:GetBucketLocation", "oss:ListObjects", "oss:GetBucketAcl"
  ]

  actions_ram = [
    "ram:GetRole"
  ]

  actions_tag = [
    "tag:TagResources", "tag:UnTagResources", "tag:ListTagResources"
  ]

  # 组装所有启用的 Action
  all_actions = concat(
    local.perm_vpc ? local.actions_vpc : [],
    local.perm_ecs ? local.actions_ecs : [],
    local.perm_cs ? local.actions_cs : [],
    local.perm_slb ? local.actions_slb : [],
    local.perm_log ? local.actions_log : [],
    local.perm_oss ? local.actions_oss : [],
    local.perm_ram ? local.actions_ram : [],
    local.perm_tag ? local.actions_tag : []
  )
}

locals {
  # 当 oss_bucket_name 指定时，OSS 用精确 Resource；否则走通用 Resource
  use_oss_precise = local.perm_oss && var.oss_bucket_name != "*"

  permission_policy = {
    Version = "1"
    Statement = concat(
      # 主权限: 所有启用的 Action（不含 OSS 当使用精确限制时）
      length(local.all_actions) > 0 ? [
        {
          Effect   = "Allow"
          Action   = local.use_oss_precise ? setsubtract(local.all_actions, local.actions_oss) : local.all_actions
          Resource = "*"
          Condition = local.region_condition
        }
      ] : [],

      # OSS 精确到特定 Bucket
      local.use_oss_precise ? [
        {
          Effect   = "Allow"
          Action   = local.actions_oss
          Resource = [
            "acs:oss:*:*:${var.oss_bucket_name}",
            "acs:oss:*:*:${var.oss_bucket_name}/*"
          ]
        }
      ] : []
    )
  }
}

resource "alicloud_ram_policy" "this" {
  policy_name     = "${var.role_name}-policy"
  policy_document = jsonencode(local.permission_policy)
  description     = "最小权限策略 for ${var.github_repo}"
}

resource "alicloud_ram_role_policy_attachment" "this" {
  policy_name = alicloud_ram_policy.this.name
  policy_type = alicloud_ram_policy.this.type
  role_name   = alicloud_ram_role.this.name
}
