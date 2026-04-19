# VPC 网络模块

> 从 `demo-ask` 和已归档的 `ack-full` 中提取的网络层通用模块。
>
> **职责**: 创建 VPC + VSwitch + NAT 网关 + EIP + SNAT 条目，为上层计算资源提供网络基础。

## 输入参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `project_name` | string | 是 | — | 资源命名前缀 |
| `region` | string | 否 | `cn-beijing` | 阿里云地域 |
| `vpc_cidr` | string | 否 | `172.16.0.0/16` | VPC 网段 |
| `zone_ids` | list(string) | 是 | — | 可用区列表 |
| `vswitch_cidrs` | list(string) | 是 | — | VSwitch 网段列表（与 zone_ids 一一对应） |
| `environment` | string | 否 | `dev` | 环境标识 |
| `nat_bandwidth` | number | 否 | `10` | NAT 网关 EIP 带宽（Mbps） |

## 输出值

| 输出 | 说明 |
|------|------|
| `vpc_id` | VPC ID |
| `vswitch_ids` | VSwitch ID 列表 |
| `nat_gateway_id` | NAT 网关 ID |

## 设计要点

- **单可用区 vs 多可用区**: `zone_ids` 和 `vswitch_cidrs` 均为数组。传入 1 个元素即单可用区（Demo），传入 2-3 个即多可用区（生产）。
- **NAT 网关**: 统一出网通道，Pod 无公网 IP 也能访问外部镜像仓库和 API。
- **标签一致性**: 所有资源自动打上 `Environment`、`Project`、`ManagedBy` 标签，便于成本归集和权限控制。
