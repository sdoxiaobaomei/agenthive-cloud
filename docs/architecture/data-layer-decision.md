# 数据层架构决策记录 (ADR-003)

> **Ticket**: PLATFORM-009-C  
> **Date**: 2024-04  
> **Status**: DECIDED — 方案 A（保持现状）  
> **Owner**: Platform Team

---

## 1. 背景

AgentHive Cloud 当前的数据层部署：

| 组件 | 当前部署 | 规格 | 地址 |
|------|---------|------|------|
| PostgreSQL | 外部 ECS (172.24.146.165) | 2C2G | `postgres:5432` |
| Redis | 外部 ECS (172.24.146.165) | 2C2G | `redis:6379` |

当前 K3s 迁移计划（PLATFORM-005 ~ PLATFORM-008）已完成应用层的 Helm Chart，数据层尚未决策。

---

## 2. 评估方案

### 方案 A：保持现状（外部 ECS）

**描述**：PostgreSQL 和 Redis 继续运行在现有 2C2G ECS 上，K3s 通过 Service/Endpoint 或直接使用 IP 连接。

| 维度 | 评分 | 说明 |
|------|------|------|
| 成本 | ⭐⭐⭐⭐⭐ | 无需新增资源，ECS 已有 |
| 性能 | ⭐⭐⭐⭐ | 网络延迟 <1ms（同 VPC），无 K8s 调度开销 |
| 高可用 | ⭐⭐ | 单节点，无自动故障转移 |
| 备份 | ⭐⭐⭐ | 需手动配置 cron + pg_dump |
| 运维复杂度 | ⭐⭐⭐⭐⭐ | 最小，团队熟悉 |
| 扩展性 | ⭐⭐ | 垂直扩展受限，水平扩展需手动 |
| 与 K8s 集成 | ⭐⭐ | 无 Service Discovery，需硬编码 IP |

### 方案 B：迁入 K3s（Operator 管理）

**描述**：使用 CloudNativePG Operator 管理 PostgreSQL，Redis Operator 或 Redis Cluster 模式管理 Redis。

| 维度 | 评分 | 说明 |
|------|------|------|
| 成本 | ⭐⭐⭐ | 需 K3s 节点额外资源（+2C4G 建议） |
| 性能 | ⭐⭐⭐ | K3s 单节点存在 I/O 争用风险 |
| 高可用 | ⭐⭐⭐⭐ | Operator 自动故障转移（需多节点） |
| 备份 | ⭐⭐⭐⭐⭐ | 自动 WAL 归档 + S3 备份 |
| 运维复杂度 | ⭐⭐ | Operator 学习曲线 + 故障排查复杂 |
| 扩展性 | ⭐⭐⭐⭐ | 读写分离、分片可由 Operator 管理 |
| 与 K8s 集成 | ⭐⭐⭐⭐⭐ | 原生 Service/PVC/Secret 集成 |

---

## 3. 决策矩阵

| 维度 | 权重 | 方案 A | 方案 B | 加权 A | 加权 B |
|------|------|--------|--------|--------|--------|
| 成本 | 25% | 5 | 3 | 1.25 | 0.75 |
| 风险（迁移）| 20% | 5 | 2 | 1.00 | 0.40 |
| 运维复杂度 | 20% | 5 | 2 | 1.00 | 0.40 |
| 高可用 | 15% | 2 | 4 | 0.30 | 0.60 |
| 备份 | 10% | 3 | 5 | 0.30 | 0.50 |
| 扩展性 | 10% | 2 | 4 | 0.20 | 0.40 |
| **总分** | 100% | | | **4.05** | **3.05** |

---

## 4. 决策结论

**选择方案 A（保持现状）**，理由如下：

1. **迁移风险最小**：当前生产数据已在外部 ECS 稳定运行，迁移可能导致数据丢失或服务中断
2. **成本最优**：无需为 K3s 节点预留数据库资源，现有 2C2G ECS 足够支撑当前负载
3. **运维简单**：团队熟悉 PostgreSQL/Redis 的运维，无需学习 Operator 的故障排查
4. **K3s 单节点限制**：方案 B 的高可用优势在单节点 K3s 上无法体现，反而增加复杂度

### 4.1 保留方案 B 的触发条件

以下任一条件满足时，重新评估迁入 K3s：

- [ ] K3s 扩展为多节点集群（≥3 节点）
- [ ] 数据库写入 QPS 持续 > 1000（需读写分离）
- [ ] 团队有 CloudNativePG Operator 运维经验
- [ ] 需要跨地域灾备（S3 WAL 归档）
- [ ] 现有 ECS 即将到期或需要升级

---

## 5. 实施方案（方案 A 的优化）

虽然保持外部部署，但进行以下优化：

### 5.1 网络连接优化

```yaml
# k8s/components/external-db/endpoint.yaml
apiVersion: v1
kind: Endpoints
metadata:
  name: postgres
  namespace: agenthive
subsets:
  - addresses:
      - ip: 172.24.146.165
    ports:
      - port: 5432
        name: postgres
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: agenthive
spec:
  ports:
    - port: 5432
      targetPort: 5432
```

这样应用可以通过 `postgres.agenthive.svc.cluster.local` 访问，无需硬编码 IP。

### 5.2 备份策略

```bash
# scripts/backup-db.sh
docker exec postgres pg_dump -U agenthive agenthive > /backup/agenthive-$(date +%Y%m%d-%H%M%S).sql
gzip /backup/agenthive-*.sql
# 保留最近 7 天，上传到 OSS
```

### 5.3 监控对接

- PostgreSQL：部署 postgres_exporter 作为 Sidecar 或独立 Pod
- Redis：部署 redis_exporter 作为 Sidecar 或独立 Pod
- 两者通过 ServiceMonitor 接入 Prometheus

---

## 6. 附件

- [CloudNativePG Operator 文档](https://cloudnative-pg.io/documentation/1.22/)
- [Redis Operator (OT-CONTAINER-KIT)](https://github.com/OT-CONTAINER-KIT/redis-operator)
- [阿里云 RDS PostgreSQL](https://www.aliyun.com/product/rds/postgresql)（未来备选）
