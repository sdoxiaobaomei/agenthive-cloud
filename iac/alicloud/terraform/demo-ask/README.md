# 阿里云 ACK Demo 环境

> 一键创建轻量 ACK 托管版集群，用完即删。适用于学习 Terraform、验证架构设计、临时演示。
>
> **成本**: 约 ¥0.5-0.8/小时（含 1 个 Worker 节点）。对比 ACK 生产环境（3 节点）约 ¥5-8/小时。

---

## 架构

```
┌──────────────────────────────────────────────┐
│            阿里云 ACK Demo (轻量)              │
├──────────────────────────────────────────────┤
│  网络层                                       │
│  ├── VPC (172.16.0.0/16)                     │
│  ├── VSwitch (172.16.1.0/24)  单可用区        │
│  ├── NAT Gateway + EIP        Pod 出网通道    │
│  └── SNAT Entry               源地址转换      │
│                                               │
│  容器层                                       │
│  └── ACK Managed Kubernetes                  │
│      ├── 托管控制平面（阿里云负责运维）        │
│      ├── 1×Worker 节点池 (ecs.u2a-c1m1.xlarge)│
│      └── 按节点实际运行时间计费               │
└──────────────────────────────────────────────┘
```

**核心概念**（1 分钟理解）:

| 概念 | 一句话解释 | 类比 |
|------|-----------|------|
| **VPC** | 你的私有网络边界 | 公司办公楼 |
| **VSwitch** | VPC 内的子网 | 办公楼的某一层 |
| **NAT 网关** | 让内网资源访问公网 | 公司的共享宽带路由器 |
| **EIP** | 独立的公网 IP | 公司的宽带账号 |
| **ACK** | 托管版 K8s，控制平面由云厂商运维 | 精装公寓（只管住，不管修） |

---

## 前置要求

1. **创建 OSS Bucket**（存放 State 文件）
2. **创建 OTS 实例和表**（State 锁定，防止并发冲突）
3. **修改 `main.tf` 中的后端配置**（将 bucket/endpoint 替换为你的实际值）

创建命令见 `main.tf` 第 23-44 行注释。

## 快速开始

1. 复制变量模板并编辑: `cp terraform.tfvars.example terraform.tfvars`
2. 配置阿里云凭证: `export ALICLOUD_ACCESS_KEY="..."` 或 `aliyun configure`
3. 初始化: `terraform init`（首次执行会自动创建 OSS 中的 State 文件）
4. 预览变更: `terraform plan`
5. 执行部署: `terraform apply`
6. 验证集群: `kubectl get nodes`
7. 用完销毁: `terraform destroy`

---

## 文件说明

| 文件 | 作用 |
|------|------|
| `main.tf` | 完整配置（VPC + ACK + NAT），290+ 行逐行注释 |
| `variables.tf` | 可配置变量（地域、可用区、项目名称） |
| `outputs.tf` | 部署完成后输出的关键信息 |
| `terraform.tfvars.example` | 变量值示例模板 |

---

## 成本估算

| 资源 | 计费方式 | Demo 场景费用 |
|------|---------|--------------|
| ACK 集群 | 集群管理费 | ~¥0.15/小时 |
| Worker 节点 (1×ecs.u2a-c1m1.xlarge) | 按量付费 | ~¥0.4/小时 |
| NAT 网关 | 实例费 + 流量费 | ~¥0.05/小时 + 流量 |
| EIP | 按量付费（按流量） | 实际使用流量计费 |
| **总计** | — | **约 ¥0.6/小时** |

> 注：实际费用与地域、运行时长、网络流量相关。建议通过阿里云费用中心按标签 `Environment=demo` 筛选查看。

---

## 常见问题

**Q: 为什么不用 ASK（Serverless K8s）？**

本方案最初计划使用 ASK（无节点、按 Pod 计费），但在实际部署中遇到 Provider 版本弃用问题（`alicloud_cs_serverless_kubernetes` 已在 v1.276.0+ 移除）。最终采用 `alicloud_cs_managed_kubernetes` + 独立 `node_pool`，这是阿里云 Provider 当前推荐的稳定做法。对于 Demo 场景，1 个 Worker 节点的成本仍然可控。

完整迁移过程和踩坑记录 → 见 [`lessons-learned-terraform-demo.md`](../../lessons-learned-terraform-demo.md)。

**Q: 为什么不用 ROS？**

ROS 是阿里云原生工具，适合一键交付。Terraform 的优势在于多云兼容、模块生态和灵活的状态管理。本知识库以 Terraform 为主，ROS 作为参考补充。

**Q: 为什么 State 后端直接使用 OSS？**

即使 Demo 场景也建议直接使用 OSS 后端：
- 多人协作时防止 State 冲突（OTS 锁定）
- State 文件不丢失（避免本地硬盘损坏/误删）
- 为团队扩展打下基础，无需后续迁移

成本几乎为零（1MB State 文件月费用 < ¥0.01）。

**Q: destroy 后为什么还收到账单？**

NAT 网关和 EIP 有小时级计费粒度，销毁后可能还有最后一小时的账单。如果使用了 LoadBalancer Service，SLB 可能残留，需手动在控制台删除。

**Q: 如何查看实时费用？**

阿里云控制台 → 费用中心 → 账单详情，按资源标签 `Environment=demo` 筛选。

---

## 下一步

- 理解模块化设计 → 查看 [`../modules/`](../modules/)
- 理解多环境管理 → 查看 [`../environments/`](../environments/)
- 排查部署问题 → 查看 [`lessons-learned-terraform-demo.md`](../../lessons-learned-terraform-demo.md)
