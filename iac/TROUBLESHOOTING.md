# Terraform 踩坑精华速查

> **定位**: 从 `lessons-learned-terraform-demo.md` 359 行流水账中提炼的核心教训。  
> **用途**: 部署前快速检查，出问题先翻这里。  
> **最后更新**: 2026-04-18

---

## 环境准备（4 条）

| 问题 | 根因 | 解决 | 黄金法则 |
|------|------|------|----------|
| `terraform init` 下载 Provider 超时 | 国内直连 GitHub DNS 超时 | `HTTP_PROXY` / `HTTPS_PROXY` 指向本地代理 | **Windows 不会自动继承系统代理，必须显式设置** |
| `no valid credential sources` | 环境变量未设置 | `$env:ALICLOUD_ACCESS_KEY = "..."` | **绝不在 `.tf` 文件写死 AccessKey** |
| `please enable cskpro container service` | ACK 需控制台手动激活 | 根账号登录 ACK 控制台 → 点击"启用" | **阿里云大部分服务都需手动激活，Terraform 做不了** |
| `account does not have enough balance` | 中国站新账号需实名认证+充值 | 实名认证 + 绑定支付宝 + 充值 ¥100 | **中国站计费管控比 AWS/GCP 严格得多** |

---

## 资源规划（3 条）

| 问题 | 根因 | 解决 | 黄金法则 |
|------|------|------|----------|
| `inventory is not enough` (NAT) | 老旧可用区（如 xxx-a）库存紧张 | 切到新区（如 `cn-beijing-l`） | **老旧 AZ 风险高：库存少、新规格支持慢** |
| `instanceTypes not authorized` | 积分型实例（t5/t6）不支持 ACK 节点池 | 最小规格 `4 vCPU / 4 GB`，推荐 `ecs.c6.xlarge` | **ACK Worker 绝对不用积分型实例；实际可用内存 ≈ 物理内存的一半** |
| 4GB 节点只剩 2GB 可用 | K8s 系统占用 ~2GB | 算 `Allocatable` 而非物理内存 | **Worker 起步 4 vCPU / 8 GB** |

---

## 版本兼容性（1 条）

| 问题 | 根因 | 解决 | 黄金法则 |
|------|------|------|----------|
| `alicloud_cs_serverless_kubernetes` 废弃 | Provider v1.276.0+ 移除 | 改用 `alicloud_cs_managed_kubernetes` + 独立 `node_pool` | **Provider 版本锁定用 `~>` 而非 `>=`** |

---

## State 管理（1 条）—— 最严重

| 问题 | 根因 | 解决 | 黄金法则 |
|------|------|------|----------|
| `destroy` 显示 0 destroyed，但云上资源仍在 | State 文件损坏/为空，Terraform "失忆" | 手动控制台清理（先删集群 → NAT → EIP → VSwitch → VPC） | 见下方 **State 管理五法则** |

### State 管理五法则

```powershell
# ✅ 正确销毁流程
terraform state list          # 1. 确认资源都在
terraform plan -destroy       # 2. 先看销毁计划
terraform destroy             # 3. 确认后再执行
# ❌ 绝不执行: Remove-Item terraform.tfstate
```

| 法则 | 说明 |
|------|------|
| **State 是唯一的真相来源** | State 丢了 = Terraform 失忆 = 资源成孤儿 |
| **Destroy 前必检查** | 先 `terraform state list`，确认资源都在 |
| **永远不手动删 state** | 除非 100% 确认云上已清空 |
| **本地 state = 定时炸弹** | 单人项目也会误删、硬盘损坏 |
| **必须用远程后端** | OSS/S3 + 状态锁定是底线 |

---

## 安全治理（1 条）

| 问题 | 根因 | 解决 | 黄金法则 |
|------|------|------|----------|
| RAM 子用户无法给其他用户授权 | 自身缺少 `AliyunRAMFullAccess` | 方案 A：用根账号授权；方案 B：**Terraform 不管理 IAM** | **基础设施代码与权限代码分离，IAM 由平台/安全团队单独管理** |

---

## 一句话总结

> **阿里云不是"AWS 中文版"。它的权限模型、服务激活流程、计费管控、库存策略都有鲜明的中国特色。用 Terraform 管理阿里云，最大的成本不是云资源费用，而是踩坑和调试的时间。**
>
> 完整流水账记录 → 见 `alicloud/lessons-learned-terraform-demo.md`
