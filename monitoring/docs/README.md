# AgentHive 可观测性系统文档

AgentHive 的可观测性栈采用 **Prometheus + Grafana + Node Exporter** 组合，专注于 **Metrics（指标）** 的采集、存储与可视化。

## 三件套关系

| 组件 | 职责 | 端口 |
|------|------|------|
| **Node Exporter** | 采集宿主机 CPU、内存、磁盘、网络等系统指标 | 9100 |
| **Prometheus** | 拉取并存储时序数据，提供查询接口 | 9090 |
| **Grafana** | 连接 Prometheus，渲染可视化仪表盘 | 3000 |

## 文档地图

| 文档 | 适合谁 | 能解决什么问题 |
|------|--------|----------------|
| [01-搭建与部署-setup.md](./01-搭建与部署-setup.md) | 首次搭建者 | 如何在本地或 VM 上从零启动三个容器，每个 `docker run` 参数的含义 |
| [02-运维与排障-operations.md](./02-运维与排障-operations.md) | 运维人员 | 容器跑起来后如何看状态、跟日志、做健康检查和重启 |
| [03-NodeExporter文件系统-node-exporter.md](./03-NodeExporter文件系统-node-exporter.md) | 需要深度调优者 | 文件系统排除规则的原理、OverlayFS 和 tmpfs 是什么、不同行业如何适配 |

## 快速入口

- **想立刻跑起来** → 阅读 [01-搭建与部署-setup.md](./01-搭建与部署-setup.md) 的 "VM 单容器部署" 章节
- **容器已启动但不确定是否正常** → 阅读 [02-运维与排障-operations.md](./02-运维与排障-operations.md) 的 "服务探活"
- **看到 Node Exporter 排除规则不理解** → 阅读 [03-NodeExporter文件系统-node-exporter.md](./03-NodeExporter文件系统-node-exporter.md) 的 "核心类型深度解释"
