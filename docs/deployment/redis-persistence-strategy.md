# Redis 持久化与数据保护策略

> **关联 Ticket**: TICKET-P0-006  
> **当前状态**: 自托管 Redis 已启用 AOF + RDB 持久化（PVC 存储）  
> **决策目标**: 评估是否需要迁移至云托管 Redis

---

## 当前架构（自托管 Redis）

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   K8s Pod   │────▶│  PVC (5Gi)  │
│  (App/API)  │     │  redis:7    │     │  AOF + RDB  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 已实施的持久化配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `appendonly` | `yes` | 开启 AOF 持久化 |
| `appendfsync` | `everysec` | 每秒 fsync，平衡性能与耐久性 |
| `save` | `900 1` / `300 10` / `60 10000` | RDB 快照策略 |
| 存储 | `ReadWriteOnce PVC` | K8s 持久卷，Pod 重建数据不丢失 |
| 存储容量 | `5Gi` | 当前配置，可按需扩容 |

### 验证持久化生效

```bash
# K8s 环境
kubectl exec -it deployment/redis -n agenthive -- redis-cli INFO persistence
# 确认 aof_enabled:1, rdb_bgsave_in_progress:0, aof_rewrite_in_progress:0

# Docker 环境
docker exec agenthive-redis-dev redis-cli INFO persistence
```

---

## 云托管 Redis 方案评估

### 候选方案：阿里云云数据库 Redis 版

| 对比维度 | 自托管 Redis (K8s) | 阿里云 Redis (主从版) | 阿里云 Redis (集群版) |
|----------|-------------------|----------------------|----------------------|
| **成本** | ¥0（复用现有 K8s 资源） | ¥200-500/月（2G 主从） | ¥800-1500/月（4G 集群） |
| **性能** | 依赖节点资源，单线程 | 专线内网，低延迟 | 分片并行，高吞吐 |
| **可用性** | 单点，Pod/节点故障时中断 | 主从自动切换（SLA 99.95%） | 多可用区，自动故障转移 |
| **持久化** | AOF + RDB + PVC | 默认双副本+AOF，无需管理 | 默认双副本+AOF，无需管理 |
| **备份** | 需自行实现（CronJob） | 自动备份，支持按时间点恢复 | 自动备份，支持按时间点恢复 |
| **扩容** | 修改 PVC + 重启 Pod | 在线平滑扩容 | 在线水平扩容 |
| **安全** | 依赖 K8s NetworkPolicy | VPC 隔离 + 白名单 + SSL | VPC 隔离 + 白名单 + SSL |
| **运维负担** | 高（监控、备份、故障恢复） | 低（托管服务） | 低（托管服务） |

### 成本详细对比（以 2GB 内存为例）

| 项目 | 自托管 | 阿里云主从版 | 备注 |
|------|--------|-------------|------|
| 计算资源 | 已含在 ACK Worker 节点 | ¥168/月 | 2G 主从版实例 |
| 存储 | PVC 费用 ¥0.35/GB/月 ≈ ¥1.75 | 含在实例费用中 | — |
| 备份 | 自行实现 CronJob | 免费（保留 7 天） | — |
| 网络 | 内网免费 | 内网免费 | 同 VPC 内 |
| **月度总成本** | **≈ ¥2** | **≈ ¥168** | — |

> 注：自托管的隐性成本包括运维人力、故障恢复时间、数据丢失风险。

---

## 决策建议

### 阶段 1：当前（MVP / 早期阶段）— 自托管 + PVC 持久化 ✅

**推荐理由**：
- 成本敏感，团队规模小，无专职 DBA
- 当前 Redis 仅用于会话、限流、任务队列，非核心交易数据
- 已实施 AOF + RDB + PVC，数据不丢失风险已可控

**风险缓解措施**：
- ✅ 已完成：PVC 替换 emptyDir
- ✅ 已完成：AOF everysec + RDB 多频率快照
- ⏳ 待补充：Redis 监控告警（内存使用率、连接数、持久化延迟）
- ⏳ 待补充：定期备份 PVC 快照（阿里云 ACK 支持 CSI 快照）

### 阶段 2：成长期（日活 > 1万 / 核心交易依赖 Redis）— 迁移阿里云 Redis

**迁移触发条件**：
- [ ] Redis 成为单点故障，业务中断不可接受
- [ ] 需要读写分离或水平扩展
- [ ] 需要跨可用区高可用
- [ ] 运维人力无法覆盖 Redis 故障恢复

**迁移路径**：

```bash
# 1. 创建阿里云 Redis 实例（同 VPC）
# 2. 配置 Redis 双写（应用层同时写入自托管 + 云 Redis）
# 3. 观察数据一致性（建议 1-2 周）
# 4. 切换读流量到云 Redis
# 5. 停止自托管写入，完成迁移
```

---

## K8s 与 Docker Compose 配置差异

| 环境 | 存储方式 | 持久化配置 | 备注 |
|------|---------|-----------|------|
| **K8s (base)** | ReadWriteOnce PVC (5Gi) | AOF + RDB | Pod 重建数据保留 |
| **K8s (overlay)** | 继承 base PVC | 继承 base | 各环境独立 namespace，PVC 隔离 |
| **Docker Compose (dev)** | Named Volume `redis_data` | AOF + RDB | `docker compose down` 不删除卷 |
| **Docker Compose (prod/demo)** | 外部 Redis (ECS 172.24.146.165) | 由外部 Redis 管理 | 当前为外部自托管，未来可替换为阿里云 Redis |

---

## 监控与告警建议

### Prometheus Rules（推荐补充）

```yaml
# k8s/components/monitoring/prometheus-rules.yaml 追加
- alert: RedisMemoryHigh
  expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Redis 内存使用率超过 80%"

- alert: RedisPersistenceDelayed
  expr: time() - redis_rdb_last_save_timestamp > 3600
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Redis RDB 快照超过 1 小时未执行"

- alert: RedisAOFRewriteFailed
  expr: redis_aof_last_rewrite_status{status!="ok"} == 1
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Redis AOF 重写失败"
```

---

## 回滚策略

若 PVC 导致 Redis 启动失败（如 StorageClass 不可用）：

```bash
# 紧急回滚到 emptyDir（数据会丢失，仅限应急）
kubectl patch deployment redis -n agenthive --type json \
  -p='[{"op": "replace", "path": "/spec/template/spec/volumes/0", "value": {"name": "data", "emptyDir": {}}}]'
```

---

## 参考

- [阿里云云数据库 Redis 版](https://www.alibabacloud.com/product/apsaradb-for-redis)
- [Redis Persistence 官方文档](https://redis.io/docs/management/persistence/)
- [Kubernetes StatefulSets vs Deployments with PVCs](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
