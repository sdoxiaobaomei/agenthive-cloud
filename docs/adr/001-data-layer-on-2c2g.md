# ADR-001: 2C2G 服务器作为全环境集中数据层

- **状态**: 已采纳
- **日期**: 2026-05-03
- **决策者**: 项目负责人

## 背景

项目有 4 台机器：

| 机器 | 配置 | 用途 | 特性 |
|------|------|------|------|
| 本地 PC | 8C16G+ | Dev 集成测试 | 按需启停 |
| 2C2G 阿里云 | 2C2G | 待定 | 包年/按量，稳定在线 |
| 4C8G Kimiclaw | 4C8G | Staging 应用层 | 稳定 |
| 8C16G 抢占式 | 8C16G | Production 应用层 | 随时可能被回收 |

Production 应用跑在抢占式实例上，数据不能放本地（回收即丢失），需要独立于应用层的数据存储。

## 决策

**2C2G 作为 Staging + Production 的集中数据层**，运行 PostgreSQL + Redis。

```
2C2G 阿里云 (数据层)
├── PostgreSQL 15
│   ├── staging_agent / staging_chat / staging_project / staging_user
│   └── prod_agent / prod_chat / prod_project / prod_user
├── Redis 7
│   ├── db0: staging
│   └── db1: production
└── pg_dump → OSS 定时备份
```

## 理由

1. **2C2G 比抢占式更可靠** — 包年/按量实例不会"被回收"，在线率远高于抢占式
2. **内存够用** — PG(~800MB) + Redis(~128MB) + OS(~300MB) ≈ 1.2GB / 2GB，有余量
3. **架构合理** — 数据层与应用层分离，抢占式实例回收后重建 Pod 即可，数据不丢
4. **零额外成本** — 已有机器，不需要新购 RDS

## 全局架构

```
┌─────────────────────────────────────────────────────┐
│  💻 本地 PC (Dev - 按需)                             │
│  Docker Compose: 全栈自包含 (含本地 PG + Redis)      │
├─────────────────────────────────────────────────────┤
│  🗄️ 2C2G (Staging + Prod 数据层)                    │
│  PostgreSQL 15 + Redis 7 + pg_dump 定时备份          │
├─────────────────────────────────────────────────────┤
│  🧪 4C8G Kimiclaw (Staging 应用层)                   │
│  K3s + Nacos + RabbitMQ → 连 2C2G                   │
├─────────────────────────────────────────────────────┤
│  🏭 8C16G 抢占式 (Production 应用层)                  │
│  K3s → 连 2C2G (内网)                               │
└─────────────────────────────────────────────────────┘
```

## 约束与缓解

| 风险 | 缓解措施 |
|------|---------|
| 单点故障 | pg_dump 每日备份到 OSS；OSS 保留 7 天 |
| PG 内存不足 | `shared_buffers=512MB`, `max_connections=50`, `statement_timeout=30s` |
| Redis OOM | `maxmemory=128MB`, `maxmemory-policy=allkeys-lru` |
| 磁盘满 | 监控 + `log_rotation_age=1d` |
| Staging/Prod 数据混合 | 独立 database 逻辑隔离，不同 PG 用户，不同 Redis db |

## 未来演进

当项目产生收入后：
- Production 迁移到阿里云 RDS（自动备份 + HA）
- 2C2G 降级为纯 Staging 数据层或退役
