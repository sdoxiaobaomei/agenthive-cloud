# 阿里云 IaC 知识库

> 本知识库聚焦阿里云基础设施的 Terraform 实践，涵盖工具选型、模块设计、部署策略和运维经验。
>
> **最后更新**: 2026-04-18

---

## 工具选型

| 工具 | 适用场景 | 选型建议 |
|------|----------|----------|
| **Terraform (alicloud provider)** | 复杂编排、多云战略、模块复用 | 首选。社区生态最活跃，Provider 覆盖度最高 |
| **ROS (资源编排服务)** | 快速标准化交付、控制台一键部署 | 补充。阿里云原生，适合非 Terraform 团队快速上手 |
| **Pulumi** | 团队偏好编程语言（TS/Python/Go） | 备选。学习曲线低，但阿里云覆盖不如 Terraform 完整 |

**决策原则**: 如果团队已有 Terraform 经验，优先 Terraform。如果需要给业务团队提供一键部署能力，ROS 作为上层封装。

---

## 目录导航

| 路径 | 文档类型 | 说明 |
|------|----------|------|
| [`terraform/demo-ask/`](terraform/demo-ask/) | 学习入口 | 最小可用 Demo，286 行逐行注释，从 VPC 到 ACK 完整链路 |
| [`terraform/environments/`](terraform/environments/) | 多环境管理 | Terraform Workspace 实现 dev/staging/prod 隔离 |
| [`terraform/modules/`](terraform/modules/) | 可复用模块 | VPC 网络模块 + K8s 集群模块 |
| [`lessons-learned-terraform-demo.md`](lessons-learned-terraform-demo.md) | 运维经验 | ASK Demo 部署踩坑实录（DNS、库存、权限、计费） |
| [`ros/template.yml`](ros/template.yml) | 参考模板 | ROS 资源编排服务模板 |

---

## 核心设计决策

### 网络层设计

所有 Terraform 配置遵循统一的网络分层：

- **VPC 网段**: `172.16.0.0/16`（Demo）或 `10.0.0.0/8`（生产），为后续扩展预留空间
- **可用区策略**: Demo 单可用区，生产跨 2-3 可用区
- **出网通道**: NAT 网关 + EIP + SNAT，Pod 无公网 IP 也能访问外部镜像仓库

### 容器层设计

- **控制平面与节点池分离**: ACK 集群资源管理控制平面，Worker 节点通过独立 `node_pool` 资源管理（Provider v1.241.0+ 推荐做法）
- **删除保护**: 生产环境开启，Demo 环境关闭以便快速清理
- **凭证获取**: 通过 `alicloud_cs_cluster_credential` 数据源获取 kubeconfig，不硬编码到 State

### 状态管理

- **后端**: OSS（对象存储），配合 OTS（Table Store）实现状态锁定
- **加密**: OSS 服务端加密 + 传输层 HTTPS
- **隔离**: 每个环境独立 State 文件前缀（`demo-ask/`、`envs/dev/`、`envs/prod/`）

---

## 安全与合规基线

| 实践项 | 要求 | 说明 |
|--------|------|------|
| 凭证管理 | RAM 子账号 + STS 临时凭证 | 禁止主账号 AccessKey 写入任何配置文件 |
| 网络隔离 | 数据库放 Private VSwitch | 生产 RDS、Redis 不暴露公网入口 |
| 标签治理 | 所有资源必须打标签 | `Environment`、`Project`、`ManagedBy` 三个必填标签 |
| 成本追踪 | 按标签分账 | 通过 `Environment=demo` 标签筛选 Demo 环境费用 |

---

## 相关资源

- [Terraform Alicloud Provider 官方文档](https://help.aliyun.com/zh/terraform)
- [Terraform Alicloud Provider GitHub 仓库](https://github.com/aliyun/terraform-provider-alicloud)
- [ROS 资源编排服务控制台](https://ros.console.aliyun.com)
