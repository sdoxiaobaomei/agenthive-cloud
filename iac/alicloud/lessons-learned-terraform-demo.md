# 阿里云 Terraform Demo 部署实操记录

> **日期**: 2026-04-18
> **目标**: 使用 Terraform 在阿里云创建轻量级 ACK Demo 环境
> **Region**: `cn-beijing` → `cn-beijing-l`
> **Provider**: `aliyun/alicloud >= 1.275.0`
> **Terraform**: `1.14.8`

---

## TL;DR

从 `terraform init` 到成功创建 ACK 集群再到销毁，全程踩坑。涉及网络、权限、计费、库存、实例规格等 **10+ 个坑点**。最终 state 文件损坏导致销毁失败，资源滞留云端，需手动清理。

---

## 🕳️ 坑点 1：Terraform Init 失败 — DNS 解析 GitHub 超时

**现象**：
```
dial tcp: lookup github.com: no such host
read tcp ... wsarecv: A connection attempt failed...
```

**根因**：GitHub 直连下载 Provider 超时，系统 DNS 实际正常（`nslookup github.com` 能解析到 IP）。

**解决**：发现本地 `localhost:7890` 运行着 Clash/V2Ray 代理，但 Terraform 没走代理：
```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
terraform init -upgrade
```

**教训**：
- Windows 下 `HTTP_PROXY` 环境变量不会自动继承系统代理设置
- `terraform init` 需要显式设置代理才能走 Clash
- **建议**：把代理写入 PowerShell Profile，避免每次手动设置

---

## 🕳️ 坑点 2：阿里云 Provider 认证失败

**现象**：
```
no valid credential sources for Terraform Alibaba Cloud Provider found
```

**根因**：`provider "alicloud"` 块只配置了 `region`，依赖环境变量，但环境变量未设置。

**解决**：
```powershell
$env:ALICLOUD_ACCESS_KEY="LTAI..."
$env:ALICLOUD_SECRET_KEY="..."
```

**教训**：
- 阿里云 Provider 支持多种认证方式（环境变量、SharedCredentialsFile、RoleArn、ECS Role）
- **最佳实践**：永远不要在 `.tf` 文件里写死 AccessKey，使用环境变量或变量传递

---

## 🕳️ 坑点 3：RAM 用户权限不足

**现象**：
```
code: 403, You are not authorized to do this action.
Resource: acs:ram:*:...:user/terraformAdmin
Action: ram:AttachPolicyToUser
```

**根因**：试图用 RAM 子用户 `terraformAdmin` 通过 Terraform 给另一个 RAM 用户附加策略，但 `terraformAdmin` 本身没有 `AliyunRAMFullAccess`。

**解决**：
- 方案 A（推荐）：用**根账号**或具备 `AliyunRAMFullAccess` 的管理员账号运行 Terraform 来附加策略
- 方案 B（实际采用）：**不在 Terraform 里管理 RAM 权限**，改为在阿里云控制台手动附加策略

**最终附加的策略清单**：

| 策略 | 用途 |
|------|------|
| `AliyunVPCFullAccess` | VPC、VSwitch、NAT、安全组 |
| `AliyunNATGatewayFullAccess` | NAT 网关 |
| `AliyunEIPFullAccess` | 弹性公网 IP |
| `AliyunCSFullAccess` | 容器服务 ACK/ASK |
| `AliyunSLBFullAccess` | 负载均衡 |
| `AliyunLogFullAccess` | 日志服务 SLS |
| `AliyunECSFullAccess` | ECS 实例（Worker 节点）|

**教训**：
- **IAM 与基础设施分离**是行业最佳实践。Terraform 应用层不应该管理身份权限
- 阿里云 RAM 策略是**按产品粒度**的，不像 AWS IAM 可以细粒度到 API Action
- 企业级做法：Landing Zone / 平台团队单独管理 IAM，应用团队只管理基础设施

---

## 🕳️ 坑点 4：CSK Pro 服务未启用

**现象**：
```
please enable cskpro container service before creating cluster
```

**根因**：阿里云 ACK/ASK 是**按账号按 Region 手动激活**的服务，即使你有 `AliyunCSFullAccess`，API 也会拒绝，直到你在控制台点击"启用"。

**解决**：
1. 用**根账号**登录 https://cs.console.aliyun.com/
2. 点击"启用容器服务"
3. 接受服务条款并授权服务关联角色
4. 等待约 1 分钟

**教训**：
- 阿里云很多服务（OSS、RDS、Function Compute、ACK）都需要**手动激活**
- 这是阿里云中国站的强监管要求，国际站相对宽松
- Terraform 无法自动激活这些服务，必须在控制台完成一次性配置

---

## 🕳️ 坑点 5：`alicloud_cs_serverless_kubernetes` 已弃用

**现象**：
```
Warning: This resource has been deprecated since v1.276.0
Please use 'alicloud_cs_managed_kubernetes' instead
```

**解决**：将资源类型从 `alicloud_cs_serverless_kubernetes` 迁移到 `alicloud_cs_managed_kubernetes`，并调整参数：

| 旧参数（Serverless） | 新参数（Managed） | 说明 |
|---------------------|------------------|------|
| `endpoint_public_access_enabled` | `slb_internet_enabled` | 公网访问 API Server |
| `vpc_id` | （移除） | Managed 版不允许直接设 vpc_id，从 vswitch 推断 |
| 无 | `cluster_spec = "ack.pro.small"` | 指定为 Pro 版 |
| 无 | `service_cidr` | 必须显式指定 |
| 无 | `pod_cidr` | 必须显式指定 |

**教训**：
- `alicloud_cs_managed_kubernetes` 从 v1.212.0+ 开始，**Worker 节点配置必须拆分到独立的 `alicloud_cs_kubernetes_node_pool` 资源**
- 内联参数 `worker_number`、`worker_instance_types`、`worker_vswitch_ids` 已被移除

---

## 🕳️ 坑点 6：库存不足

**现象**：
```
Operation failed because inventory is not enough
```

**根因**：`cn-beijing-a` 的 Enhanced NAT 网关无库存。

**连锁反应**：
1. 尝试降级为 `nat_type = "Normal"` → 报错：`Standard NAT gateways are no longer offered`
2. `cn-beijing-a` 陷入死局：**Standard 已下线，Enhanced 无库存**

**解决**：切换可用区到 `cn-beijing-l`

```hcl
zone_id = "cn-beijing-l"
```

**教训**：
- **老旧可用区（如 xxx-a）风险高**：新规格支持慢、库存紧张
- 企业最佳实践：**平台团队预先验证 2-3 个可用区**，业务团队只从这中间选

---

## 🕳️ 坑点 7：实例类型不支持

**现象**：
```
The instanceTypes are not authorized or not supported in current zones
```

**根因**：硬编码了 `ecs.t5-lc1m2.small`（2 vCPU / 2 GB），但 `t5` 是积分型实例，ACK 节点池不支持，且 `cn-beijing-l` 根本没有这个规格。

**解决过程**：
1. 尝试用 `data "alicloud_instance_types"` 动态查询 → 返回空列表
2. 确认最小可用规格是 **4 vCPU / 4 GB**
3. 最终选择 `ecs.u2a-c1m1.xlarge`（AMD 第二代通用算力型）

**教训**：
- **不要在生产环境用动态查询实例类型**，Plan 结果不可复现
- ACK Worker 节点**绝对不要用积分型实例**（t5、t6、u1/u2 系列）
- 4GB 内存对于 K8s Worker 是**实际下限**（系统占用后只剩 ~2GB 给业务）

---

## 🕳️ 坑点 8：账户余额不足

**现象**：
```
Your account does not have enough balance to order postpaid product
```

**根因**：阿里云中国站即使创建按量付费资源，也要求账户有正余额或绑定有效支付方式。

**解决**：
1. 完成**实名认证**
2. 绑定**信用卡或支付宝**
3. 充值 **¥100** 作为押金

**教训**：
- 阿里云中国站的计费管控比 AWS/GCP/Azure 更严格
- 新账号必须先完成实名认证才能创建任何资源

---

## 🕳️ 坑点 9：内存幻觉 — 4GB 节点只剩 2GB 可用

**现象**：Pod 还没跑应用内存就用了一半。

**根因分析**：

```
物理内存: 4096 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- OS + K8s 守护进程:      ~900 MB
- ACK 系统 Pod:           ~600 MB
- Reserved + Eviction:    ~450 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
= Allocatable:            ~2146 MB
```

**教训**：
- K8s 节点内存**不要只看物理规格**，要看 `kubectl describe node` 里的 `Allocatable`
- **推荐 Worker 节点起步规格：4 vCPU / 8 GB**（`ecs.c6.xlarge`）

---

## 🕳️ 坑点 10：State 文件损坏导致销毁失败（最严重）

**现象**：
```
Destroy complete! Resources: 0 destroyed.
```

销毁后阿里云控制台依然能看到所有资源：VPC、VSwitch、NAT、ECS、ACK 集群。

**根因**：
1. `terraform.tfstate` 文件在销毁前已经损坏（`resources` 数组为空）
2. Terraform 读取到空 state → 认为没有资源需要销毁 → 什么都没做
3. 清理脚本又删除了 `terraform.tfstate` 和 `terraform.tfstate.backup`
4. 现在 Terraform 彻底失联，云上资源变成**孤儿资源**

```
Terraform 视角          阿里云控制台视角
     │                         │
     ▼                         ▼
  State 为空              VPC/ECS/集群 完好无损
  "我不知道有什么"         "资源正常 running"
     │                         │
     └── destroy ────►     "什么都没发生"
```

### 为什么不能用 terraform import 恢复？

理论上 `terraform import` 可以把云端资源重新纳管到 state，但本次场景下**不可行**：

1. **资源配置已漂移**：云上集群是用旧版 `alicloud_cs_serverless_kubernetes` 创建的，但当前 `main.tf` 已改成 `alicloud_cs_managed_kubernetes`。资源类型不匹配，import 会失败。
2. **关联资源 ID 已丢失**：SNAT 条目、EIP 绑定等子资源的 ID 仅存在于已删除的 state 中，无法精确重建 import 命令。
3. **时间成本**：手动 import 7 个资源 + 处理依赖关系，比控制台点 5 下删除更慢。

### 手动清理顺序

1. [ACK 集群](https://cs.console.aliyun.com/) — 先删集群，自动释放节点池和 ECS
2. [NAT 网关](https://vpc.console.aliyun.com/natgateway)
3. [弹性公网 IP](https://vpc.console.aliyun.com/eip)
4. [交换机](https://vpc.console.aliyun.com/vswitch)
5. [专有网络](https://vpc.console.aliyun.com/vpc)

### 核心教训（State 管理黄金法则）

| 法则 | 说明 |
|------|------|
| **State 是唯一的真相来源** | State 丢了 = Terraform 失忆 = 资源成孤儿 |
| **Destroy 前必检查** | 先执行 `terraform state list`，确认资源都在 state 里 |
| **永远不要手动删 state** | 除非 100% 确认云上资源已清空 |
| **本地 state = 定时炸弹** | 单人项目也可能误删、硬盘损坏、gitignore 漏提交 |
| **必须用远程后端** | 团队协作时 OSS/S3 后端 + State 锁定是底线要求 |

**正确的销毁流程**：
```powershell
terraform state list          # 1. 确认资源都在
terraform plan -destroy       # 2. 先看销毁计划
terraform destroy             # 3. 确认后再执行
# ❌ 绝不执行: Remove-Item terraform.tfstate
```

**推荐的远程后端配置**（加到 `main.tf`）：
```hcl
terraform {
  backend "oss" {
    bucket = "your-terraform-state-bucket"
    prefix = "demo-ask"
    region = "cn-beijing"
  }
}
```

---

## ✅ 最终成功的配置

```hcl
# terraform.tfvars
region       = "cn-beijing"
zone_id      = "cn-beijing-l"
project_name = "agenthive"
```

```hcl
# main.tf — 网络层
resource "alicloud_vpc" "demo" { ... }
resource "alicloud_vswitch" "demo" { ... }
resource "alicloud_nat_gateway" "demo" {
  nat_type = "Enhanced"
}
resource "alicloud_eip_address" "demo" { ... }
resource "alicloud_eip_association" "demo" { ... }
resource "alicloud_snat_entry" "demo" { ... }
```

```hcl
# main.tf — K8s 层（Basic ACK，无 CSK Pro）
resource "alicloud_cs_managed_kubernetes" "demo" {
  name                 = "agenthive-demo-ask"
  vswitch_ids          = [alicloud_vswitch.demo.id]
  slb_internet_enabled = true
  service_cidr         = "172.21.0.0/20"
  pod_cidr             = "172.20.0.0/16"
}

resource "alicloud_cs_kubernetes_node_pool" "demo" {
  instance_types       = ["ecs.u2a-c1m1.xlarge"]
  desired_size         = 1
  system_disk_category = "cloud_essd"
  instance_charge_type = "PostPaid"
}
```

---

## 🏗️ 企业级最佳实践总结

| 方面 | Demo 做法 | 企业最佳实践 |
|------|----------|-------------|
| **认证** | RAM 用户 + AccessKey 环境变量 | CloudSSO/SAML + AssumeRole + OIDC |
| **权限管理** | 控制台手动附加 7 个策略 | 独立的 `platform-iam` Terraform 仓库 |
| **可用区选择** | trial-and-error | Landing Zone 预先验证 2-3 个 AZ |
| **实例类型** | 硬编码 `u2a-c1m1.xlarge` | 平台团队维护白名单（c7/g7/r7） |
| **NAT 网关** | `Enhanced` 单可用区 | 跨 AZ 高可用 + 共享 NAT |
| **K8s 集群** | Basic ACK 单节点 | ACK Pro + Cluster Autoscaler + Spot |
| **服务激活** | 控制台手动点"启用" | 账号工厂初始化时统一激活 |
| **计费** | 个人账号充值 ¥100 | 企业财务云账号 + 预算管控 |
| **State 管理** | 本地 `terraform.tfstate` | **远程 OSS 后端 + State 锁定** |

---

> **核心感悟**：阿里云不是"AWS 中文版"。它的权限模型、服务激活流程、计费管控、库存策略都有鲜明的中国特色。用 Terraform 管理阿里云，**最大的成本不是云资源费用，而是踩坑和调试的时间**。
