# ACK/K8s 集群模块

> 从已归档的 `ack-full` 和 `demo-ask` 中提取的容器层通用模块。
>
> **职责**: 创建 ACK 托管版集群 + 节点池，输出集群凭证供 CI/CD 和本地 kubectl 使用。

## 输入参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `project_name` | string | 是 | — | 资源命名前缀 |
| `cluster_name` | string | 是 | — | ACK 集群名称 |
| `vpc_id` | string | 是 | — | VPC ID |
| `vswitch_ids` | list(string) | 是 | — | VSwitch ID 列表 |
| `service_cidr` | string | 否 | `172.21.0.0/20` | K8s Service 网段 |
| `pod_cidr` | string | 否 | `172.20.0.0/16` | K8s Pod 网段 |
| `worker_instance_types` | list(string) | 否 | `["ecs.u2a-c1m1.xlarge"]` | Worker 实例规格 |
| `worker_desired_size` | number | 否 | `1` | Worker 节点数量 |
| `worker_disk_size` | number | 否 | `40` | 系统盘大小（GB） |
| `deletion_protection` | bool | 否 | `false` | 是否开启删除保护 |
| `environment` | string | 否 | `dev` | 环境标识 |

## 输出值

| 输出 | 说明 |
|------|------|
| `cluster_id` | ACK 集群 ID |
| `cluster_name` | 集群名称 |
| `kubeconfig` | 集群 kubeconfig（敏感，标记为 sensitive） |
| `api_server_internet` | API Server 公网端点 |

## 设计要点

- **集群与节点池分离**: ACK 集群资源只负责控制平面，Worker 节点通过独立 `node_pool` 资源管理。这是阿里云 Provider v1.241.0+ 的推荐做法。
- **删除保护**: 生产环境建议开启（`true`），Demo 环境关闭以便 `terraform destroy` 快速清理。
- **Addons**: 默认安装 CSI 存储插件、Metrics Server（支持 HPA 和 `kubectl top`）。
