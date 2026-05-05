# AgentHive Cloud 数据库维护架构设计（企业级）

> 版本：v1.0
> 日期：2026-05-02
> 作者：后端架构组

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           数据库维护架构全景图                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │  开发环境    │────▶│  测试环境    │────▶│  预发环境    │────▶│  生产环境    │   │
│   │  (Dev)      │     │  (Test)     │     │  (Staging)  │     │  (Prod)     │   │
│   └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘   │
│          │                   │                   │                   │          │
│          ▼                   ▼                   ▼                   ▼          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     版本化迁移管理 (Flyway/pgMigrate)                    │   │
│   │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐    │   │
│   │  │ V001    │──▶│ V002    │──▶│ V003    │──▶│ V004    │──▶│ V005    │    │   │
│   │  │ init    │   │ owner   │   │ member  │   │ audit   │   │ idx     │    │   │
│   │  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘    │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        高可用架构 (HA)                                    │   │
│   │                                                                         │   │
│   │   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐          │   │
│   │   │   Primary    │─────▶│   Standby    │─────▶│   Witness    │          │   │
│   │   │  (RW)        │      │  (RO/Failover)│      │  (Arbiter)   │          │   │
│   │   └──────────────┘      └──────────────┘      └──────────────┘          │   │
│   │          │                     │                                          │   │
│   │          └──────────┬───────────┘                                          │   │
│   │                     ▼                                                     │   │
│   │            ┌──────────────┐                                               │   │
│   │            │ PgBouncer    │  (连接池 + 负载均衡)                            │   │
│   │            │ Pooler       │                                               │   │
│   │            └──────────────┘                                               │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        备份恢复策略                                       │   │
│   │                                                                         │   │
│   │   Tier 1: 实时归档 ──────▶ WAL ──────▶ MinIO (异地)                      │   │
│   │   Tier 2: 全量备份 ──────▶ Daily ─────▶ MinIO + 本地                      │   │
│   │   Tier 3: 快照备份 ──────▶ Hourly ────▶ 云存储                            │   │
│   │   Tier 4: 逻辑备份 ──────▶ Weekly ────▶ 跨区域复制                        │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        监控告警体系                                       │   │
│   │                                                                         │   │
│   │   postgres_exporter ──▶ Prometheus ──▶ Alertmanager ──▶ PagerDuty/钉钉   │   │
│   │                              │                                          │   │
│   │                              ▼                                          │   │
│   │                           Grafana                                       │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、数据库实例规划

### 2.1 生产环境数据库拓扑

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          生产环境数据库集群                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Zone A (主可用区)                          Zone B (备可用区)                    │
│  ┌────────────────────────┐                ┌────────────────────────┐           │
│  │ postgres-primary      │─────同步复制───▶│ postgres-standby       │           │
│  │ (RW, Primary)         │                │ (RO, Hot Standby)      │           │
│  │                       │                │                        │           │
│  │ • agenthive (主库)    │                │ • agenthive (副本)     │           │
│  │ • auth_db             │                │ • auth_db              │           │
│  │ • user_db             │                │ • user_db              │           │
│  │ • payment_db          │                │ • payment_db           │           │
│  │ • business_db         │                │ • business_db          │           │
│  └────────────────────────┘                └────────────────────────┘           │
│           │                                          │                         │
│           │                                          │                         │
│           ▼                                          ▼                         │
│  ┌────────────────────────┐                ┌────────────────────────┐           │
│  │ PgBouncer (RW Pool)   │                │ PgBouncer (RO Pool)    │           │
│  │ pool_size: 100        │                │ pool_size: 200         │           │
│  └────────────────────────┘                └────────────────────────┘           │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ MinIO Cluster (对象存储)                                                  │   │
│  │ • 备份存储 (agenthive-backups)                                            │   │
│  │ • WAL 归档 (agenthive-wal-archive)                                       │   │
│  │ • 跨区域复制 → 华南/华北                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据库实例配置

| 实例名 | 用途 | CPU | 内存 | 存储 | 副本数 |
|--------|------|-----|------|------|--------|
| postgres-primary | 主数据库 | 4 核 | 16GB | 500GB SSD | 1 |
| postgres-standby | 备数据库 | 4 核 | 16GB | 500GB SSD | 1 |
| postgres-chat | 聊天服务专用 | 2 核 | 8GB | 200GB SSD | 1 |
| postgres-project | 项目服务专用 | 2 核 | 8GB | 200GB SSD | 1 |
| postgres-agent | Agent 服务专用 | 2 核 | 8GB | 200GB SSD | 1 |

### 2.3 连接池配置

```yaml
# PgBouncer 配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: pgbouncer-config
  namespace: agenthive
data:
  pgbouncer.ini: |
    [databases]
    agenthive = host=postgres-primary port=5432 dbname=agenthive
    auth_db = host=postgres-primary port=5432 dbname=auth_db
    user_db = host=postgres-primary port=5432 dbname=user_db
    payment_db = host=postgres-primary port=5432 dbname=payment_db
    business_db = host=postgres-primary port=5432 dbname=business_db

    [pgbouncer]
    pool_mode = transaction
    max_client_conn = 500
    default_pool_size = 25
    min_pool_size = 5
    reserve_pool_size = 5
    reserve_pool_timeout = 3
    max_db_connections = 100
    listen_addr = 0.0.0.0
    listen_port = 6432
    auth_type = md5
    auth_file = /etc/pgbouncer/userlist.txt
    admin_users = agenthive
    stats_users = agenthive
    logfile = /var/log/pgbouncer/pgbouncer.log
    pidfile = /var/run/pgbouncer/pgbouncer.pid

    # 超时配置
    server_lifetime = 3600
    server_idle_timeout = 600
    server_connect_timeout = 15
    server_login_retry = 3
    client_login_timeout = 30
    client_idle_timeout = 0
    query_timeout = 30
    statement_timeout = 30
```

---

## 三、迁移管理架构

### 3.1 迁移工具选择

**方案对比**：

| 工具 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **Flyway** | 成熟稳定、Java 原生、支持回滚 | Java 依赖、版本命名严格 | Java 微服务 |
| **node-pg-migrate** | Node 原生、灵活、可编程 | 社区较小 | Node API |
| **Prisma Migrate** | 类型安全、ORM 集成 | 重度依赖 Prisma | 新项目 |
| **golang-migrate** | 语言无关、支持多种数据库 | 需要额外工具 | 混合技术栈 |

**决策**：
- **Java 微服务**：继续使用 **Flyway**（已集成）
- **Node API**：引入 **node-pg-migrate**（轻量、可控）

### 3.2 Node API 迁移架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          迁移管理流程                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   开发阶段                                                                      │
│   ┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │ 修改    │────▶│ 生成迁移文件 │────▶│ 编写 Up/Down │────▶│ 本地测试     │   │
│   │ Schema  │     │ npm run      │     │ SQL          │     │ npm run      │   │
│   │         │     │ migrate:create│     │              │     │ migrate:up   │   │
│   └─────────┘     └──────────────┘     └──────────────┘     └──────────────┘   │
│                                                                                 │
│   CI/CD 阶段                                                                    │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐  │
│   │ PR 检查      │────▶│ Test 环境     │────▶│ Staging 环境 │────▶│ 生产环境 │  │
│   │ 迁移文件     │     │ 自动执行迁移  │     │ 手动审批     │     │ 自动执行 │  │
│   │ 合规性检查   │     │              │     │ 自动执行     │     │          │  │
│   └──────────────┘     └──────────────┘     └──────────────┘     └──────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 迁移目录结构

```
apps/api/
├── src/db/
│   ├── schema.sql                 # 完整 schema（开发参考用）
│   └── migrations/
│       ├── .nodemigrate.json      # node-pg-migrate 配置
│       ├── 20260423000000_init.sql
│       ├── 20260424000000_add-agent-ownership.sql
│       ├── 20260425000000_add-task-user-id.sql
│       ├── 20260426000000_add-audit-logging.sql
│       └── 20260427000000_add-indexes.sql
│
├── scripts/
│   ├── migrate.ts                 # 迁移执行脚本
│   └── rollback.ts                # 回滚脚本
│
└── package.json
    └── scripts:
        "db:migrate": "tsx scripts/migrate.ts up",
        "db:rollback": "tsx scripts/migrate.ts down",
        "db:create": "tsx scripts/migrate.ts create",
        "db:status": "tsx scripts/migrate.ts status"
```

### 3.4 迁移文件规范

**命名规范**：
```
{timestamp}_{description}.sql

示例：
20260423000000_init.sql                    # 初始化 schema
20260424000000_add-agent-ownership.sql    # 添加 agent.owner_id
20260425000000_add-task-user-id.sql       # 添加 task.user_id
```

**文件格式**：
```sql
-- Migration: add-agent-ownership
-- Created: 2026-04-24
-- Author: backend-team
-- Ticket: TICKET-P0-002

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- 检查是否已执行
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM _migrations 
        WHERE name = 'add-agent-ownership'
    ) THEN
        RAISE NOTICE 'Migration already applied, skipping';
        RETURN;
    END IF;
END $$;

-- 1. 添加 owner_id
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS owner_id UUID 
REFERENCES users(id) ON DELETE SET NULL;

-- 2. 创建 agent_members 协作表
CREATE TABLE IF NOT EXISTS agent_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, user_id)
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agent_members_agent_id ON agent_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_members_user_id ON agent_members(user_id);

-- 4. 创建权限检查函数
CREATE OR REPLACE FUNCTION user_can_operate_agent(
    p_user_id UUID,
    p_agent_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM agents a
        LEFT JOIN agent_members am ON a.id = am.agent_id
        WHERE a.id = p_agent_id
        AND (a.owner_id = p_user_id OR am.user_id = p_user_id AND am.role IN ('owner', 'admin'))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 记录迁移
INSERT INTO _migrations (name, applied_at)
VALUES ('add-agent-ownership', NOW());

COMMIT;

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================

--ROLLBACK;

BEGIN;

DROP FUNCTION IF EXISTS user_can_operate_agent(UUID, UUID);
DROP TABLE IF EXISTS agent_members;
ALTER TABLE agents DROP COLUMN IF EXISTS owner_id;
DELETE FROM _migrations WHERE name = 'add-agent-ownership';

COMMIT;
```

### 3.5 迁移管理表

```sql
-- 迁移记录表
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100),
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- 迁移锁表（防止并发迁移）
CREATE TABLE IF NOT EXISTS _migration_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100),
    CONSTRAINT single_row CHECK (id = 1)
);

-- 获取迁移锁
INSERT INTO _migration_lock (id, locked_at, locked_by)
VALUES (1, NOW(), current_user)
ON CONFLICT (id) DO UPDATE
SET locked_at = NOW(), locked_by = current_user;

-- 释放迁移锁
UPDATE _migration_lock SET locked_at = NULL, locked_by = NULL WHERE id = 1;
```

---

## 四、备份恢复策略

### 4.1 备份策略矩阵

| 备份类型 | 频率 | 保留期 | 存储位置 | 恢复时间 | 用途 |
|----------|------|--------|----------|----------|------|
| **WAL 归档** | 实时 | 7 天 | MinIO | 分钟级 | 时间点恢复（PITR） |
| **全量备份** | 每日 02:00 | 30 天 | MinIO + 本地 | 小时级 | 灾难恢复 |
| **增量备份** | 每小时 | 24 小时 | MinIO | 分钟级 | 快速恢复 |
| **快照备份** | 每 6 小时 | 7 天 | 云存储 | 秒级 | 测试环境克隆 |
| **逻辑备份** | 每周日 | 90 天 | 跨区域 | 小时级 | 合规归档 |

### 4.2 备份存储架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          备份存储架构                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   MinIO Cluster (主存储)                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ Bucket: agenthive-backups                                                │   │
│   │                                                                         │   │
│   │ ├── postgres/                                                           │   │
│   │ │   ├── agenthive/                                                      │   │
│   │ │   │   ├── 2026-05-01/                                                 │   │
│   │ │   │   │   ├── agenthive_20260501_020000.sql.gz.enc                   │   │
│   │ │   │   │   ├── agenthive_20260501_080000.sql.gz.enc                   │   │
│   │ │   │   │   └── agenthive_20260501_140000.sql.gz.enc                   │   │
│   │ │   │   └── ...                                                         │   │
│   │ │   ├── auth_db/                                                        │   │
│   │ │   ├── user_db/                                                        │   │
│   │ │   └── ...                                                             │   │
│   │ │                                                                       │   │
│   │ ├── wal-archive/                                                        │   │
│   │ │   └── 2026-05-02/                                                    │   │
│   │ │       ├── 000000010000000000000001                                    │   │
│   │ │       ├── 000000010000000000000002                                    │   │
│   │ │       └── ...                                                         │   │
│   │ │                                                                       │   │
│   │ └── snapshots/                                                          │   │
│   │     └── 2026-05-02/                                                    │   │
│   │         ├── agenthive-snapshot-0600.tar.gz                             │   │
│   │         └── agenthive-snapshot-1200.tar.gz                             │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   跨区域复制                                                                    │
│   ┌──────────────────┐                    ┌──────────────────┐                 │
│   │ 华南 (广州)       │──────异步复制──────▶│ 华北 (北京)       │                 │
│   │ Primary MinIO    │                    │ DR MinIO         │                 │
│   └──────────────────┘                    └──────────────────┘                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 WAL 归档配置

```yaml
# PostgreSQL WAL 归档配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-archive-config
  namespace: agenthive
data:
  postgresql.conf: |
    # WAL 配置
    wal_level = replica
    archive_mode = on
    archive_command = 'aws s3 cp %p s3://agenthive-wal-archive/$(date +%Y-%m-%d)/%f --endpoint-url=http://minio:9000'
    archive_timeout = 300  # 5 分钟强制归档
    
    # 复制槽
    max_replication_slots = 5
    hot_standby = on
    
    # 检查点
    checkpoint_completion_target = 0.9
    checkpoint_timeout = 15min
    max_wal_senders = 5
    wal_keep_size = 2GB
```

### 4.4 恢复流程

**场景一：时间点恢复（PITR）**

```bash
# 1. 停止应用
kubectl scale deploy/api --replicas=0 -n agenthive

# 2. 恢复基础备份
pg_restore -h postgres-recovery -U agenthive -d agenthive \
  /backups/agenthive_20260501_020000.sql.gz

# 3. 应用 WAL 日志到指定时间点
recovery_target_time = '2026-05-02 14:30:00'
restore_command = 'aws s3 cp s3://agenthive-wal-archive/%f %p --endpoint-url=http://minio:9000'

# 4. 验证数据
psql -h postgres-recovery -U agenthive -d agenthive -c "SELECT COUNT(*) FROM agents;"

# 5. 切换流量
kubectl patch service postgres -p '{"spec":{"selector":{"statefulset.kubernetes.io/pod-name":"postgres-recovery-0"}}}'
```

**场景二：灾难恢复**

```bash
# 1. 在 DR 站点启动 PostgreSQL
kubectl apply -f k8s/dr/postgres-standby.yaml

# 2. 从 MinIO 同步最新备份
mc mirror local/agenthive-backups dr-minio/agenthive-backups

# 3. 恢复数据库
./scripts/db/restore-postgres.sh agenthive latest dr-postgres 5432

# 4. 启动应用
kubectl apply -f k8s/dr/

# 5. DNS 切换
kubectl patch ingress agenthive-ingress -p '{"spec":{"rules":[{"host":"agenthive.xiaochaitian.asia"}]}}'
```

---

## 五、高可用架构

### 5.1 Patroni 集群配置

```yaml
# Patroni 高可用配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: patroni-config
  namespace: agenthive
data:
  patroni.yml: |
    scope: agenthive-cluster
    namespace: /db/
    name: ${POD_NAME}
    
    restapi:
      listen: 0.0.0.0:8008
      connect_address: ${POD_IP}:8008
    
    postgresql:
      data_dir: /var/lib/postgresql/data
      pgpass: /tmp/pgpass
      listen: 0.0.0.0:5432
      connect_address: ${POD_IP}:5432
      
      authentication:
        replication:
          username: replicator
          password: ${REPLICATION_PASSWORD}
        superuser:
          username: agenthive
          password: ${DB_PASSWORD}
      
      parameters:
        wal_level: replica
        hot_standby: "on"
        max_wal_senders: 5
        max_replication_slots: 5
        wal_keep_size: 2GB
        archive_mode: on
        archive_command: "aws s3 cp %p s3://agenthive-wal-archive/%f --endpoint-url=http://minio:9000"
    
    bootstrap:
      dcs:
        ttl: 30
        loop_wait: 10
        retry_timeout: 10
        maximum_lag_on_failover: 1048576
        postgresql:
          use_pg_rewind: true
          use_slots: true
          parameters:
            max_connections: 200
            shared_buffers: 4GB
            effective_cache_size: 12GB
            maintenance_work_mem: 1GB
            checkpoint_completion_target: 0.9
            wal_buffers: 16MB
            default_statistics_target: 100
            random_page_cost: 1.1
            effective_io_concurrency: 200
            work_mem: 20MB
            min_wal_size: 1GB
            max_wal_size: 4GB
      
      initdb:
        - encoding: UTF8
        - data-checksums
        - locale: en_US.UTF-8
      
      users:
        agenthive:
          password: ${DB_PASSWORD}
          options:
            - createdb
            - superuser
```

### 5.2 故障切换流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          故障切换流程                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   正常状态                                                                      │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐                  │
│   │ postgres-0   │─────▶│ postgres-1   │─────▶│ postgres-2   │                  │
│   │ (Leader)     │ 同步 │ (Replica)    │ 异步 │ (Replica)    │                  │
│   │ RW           │      │ RO          │      │ RO           │                  │
│   └──────────────┘      └──────────────┘      └──────────────┘                  │
│          ▲                                                                      │
│          │                                                                      │
│          ▼                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │                     Patroni 自动故障检测                                │   │
│   │                                                                        │   │
│   │  1. 心跳超时 (30s) → 标记 Leader 不健康                                 │   │
│   │  2. DCS (etcd/Consul) 选举新 Leader                                    │   │
│   │  3. 提升 postgres-1 为 Leader                                          │   │
│   │  4. 更新 Service 端点                                                  │   │
│   │  5. 通知应用层重连                                                      │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   故障切换后                                                                    │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐                  │
│   │ postgres-0   │      │ postgres-1   │─────▶│ postgres-2   │                  │
│   │ (Down)       │      │ (Leader)     │ 同步 │ (Replica)    │                  │
│   │ ❌           │      │ RW           │      │ RO           │                  │
│   └──────────────┘      └──────────────┘      └──────────────┘                  │
│                                 ▲                                               │
│                                 │                                               │
│                                 ▼                                               │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │ 恢复 postgres-0 后自动加入集群为 Replica                                │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、监控告警体系

### 6.1 监控指标

```yaml
# Prometheus postgres_exporter 配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-exporter-queries
  namespace: monitoring
data:
  queries.yaml: |
    # 连接池监控
    pg_stat_activity:
      query: |
        SELECT state, count(*) as count
        FROM pg_stat_activity
        WHERE state IS NOT NULL
        GROUP BY state
      metrics:
        - state:
            usage: "LABEL"
            description: "Connection state"
        - count:
            usage: "GAUGE"
            description: "Number of connections"
    
    # 复制延迟
    pg_replication_lag:
      query: |
        SELECT 
          client_addr,
          state,
          sent_lsn,
          replay_lsn,
          pg_wal_lsn_diff(sent_lsn, replay_lsn) as lag_bytes
        FROM pg_stat_replication
      metrics:
        - client_addr:
            usage: "LABEL"
            description: "Replica address"
        - lag_bytes:
            usage: "GAUGE"
            description: "Replication lag in bytes"
    
    # 表膨胀
    pg_table_bloat:
      query: |
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_dead_tup,
          n_live_tup,
          round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) as dead_ratio
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
        ORDER BY n_dead_tup DESC
        LIMIT 20
      metrics:
        - tablename:
            usage: "LABEL"
            description: "Table name"
        - dead_ratio:
            usage: "GAUGE"
            description: "Dead tuple ratio"
```

### 6.2 告警规则

```yaml
# PrometheusRule 配置
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: postgres-alerts
  namespace: monitoring
spec:
  groups:
    - name: postgres.rules
      rules:
        # P0: 数据库不可用
        - alert: PostgresDown
          expr: pg_up == 0
          for: 1m
          labels:
            severity: critical
            team: dba
          annotations:
            summary: "PostgreSQL 实例宕机"
            description: "PostgreSQL {{ $labels.instance }} 已宕机超过 1 分钟"
        
        # P0: 复制中断
        - alert: ReplicationLagHigh
          expr: pg_replication_lag_bytes > 1073741824  # 1GB
          for: 5m
          labels:
            severity: critical
            team: dba
          annotations:
            summary: "复制延迟超过 1GB"
            description: "PostgreSQL 复制延迟 {{ $value | humanize1024 }}B"
        
        # P1: 连接池耗尽
        - alert: ConnectionPoolExhausted
          expr: pg_stat_activity_count{state="active"} / pg_settings_max_connections > 0.8
          for: 5m
          labels:
            severity: warning
            team: dba
          annotations:
            summary: "连接池使用率超过 80%"
            description: "当前活跃连接 {{ $value }}%"
        
        # P1: 表膨胀
        - alert: TableBloatHigh
          expr: pg_table_bloat_dead_ratio > 20
          for: 30m
          labels:
            severity: warning
            team: dba
          annotations:
            summary: "表膨胀超过 20%"
            description: "表 {{ $labels.tablename }} 膨胀率 {{ $value }}%"
        
        # P2: 慢查询
        - alert: SlowQueries
          expr: rate(pg_stat_statements_total_time_seconds[5m]) > 10
          for: 10m
          labels:
            severity: info
            team: backend
          annotations:
            summary: "检测到慢查询"
            description: "平均查询时间 {{ $value }}s"
        
        # P2: 磁盘空间不足
        - alert: DiskSpaceLow
          expr: pg_database_size_bytes / node_filesystem_size_bytes{mountpoint="/var/lib/postgresql"} > 0.85
          for: 15m
          labels:
            severity: warning
            team: dba
          annotations:
            summary: "数据库磁盘使用率超过 85%"
            description: "当前使用率 {{ $value | humanizePercentage }}"
```

### 6.3 Grafana Dashboard

```json
{
  "title": "PostgreSQL Database Dashboard",
  "panels": [
    {
      "title": "Connection Pool",
      "type": "graph",
      "targets": [
        {
          "expr": "pg_stat_activity_count{state=\"active\"}",
          "legendFormat": "Active"
        },
        {
          "expr": "pg_stat_activity_count{state=\"idle\"",
          "legendFormat": "Idle"
        },
        {
          "expr": "pg_settings_max_connections",
          "legendFormat": "Max Connections"
        }
      ]
    },
    {
      "title": "Replication Lag",
      "type": "graph",
      "targets": [
        {
          "expr": "pg_replication_lag_bytes",
          "legendFormat": "{{ client_addr }}"
        }
      ]
    },
    {
      "title": "Query Performance",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(pg_stat_statements_total_time_seconds[5m])",
          "legendFormat": "Avg Query Time"
        }
      ]
    },
    {
      "title": "Database Size",
      "type": "gauge",
      "targets": [
        {
          "expr": "pg_database_size_bytes",
          "legendFormat": "{{ datname }}"
        }
      ]
    }
  ]
}
```

---

## 七、审计日志

### 7.1 审计表设计

```sql
-- 数据变更审计表
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,  -- INSERT/UPDATE/DELETE
    record_id VARCHAR(100),           -- 被操作记录的 ID
    old_values JSONB,                -- 变更前数据
    new_values JSONB,                -- 变更后数据
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_id UUID
);

-- 索引
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);

-- 分区（按月）
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

### 7.2 审计触发器

```sql
-- 通用审计触发器函数
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, operation, record_id, new_values, changed_by)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id::TEXT, to_jsonb(NEW), current_setting('app.current_user_id', TRUE)::UUID);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, operation, record_id, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW), current_setting('app.current_user_id', TRUE)::UUID);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, operation, record_id, old_values, changed_by)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id::TEXT, to_jsonb(OLD), current_setting('app.current_user_id', TRUE)::UUID);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为关键表添加审计触发器
CREATE TRIGGER agents_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON agents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER tasks_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER projects_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### 7.3 查询审计日志

```sql
-- 查看用户操作历史
SELECT 
    al.table_name,
    al.operation,
    al.record_id,
    al.changed_at,
    u.username as changed_by_user,
    al.old_values,
    al.new_values
FROM audit_logs al
LEFT JOIN users u ON al.changed_by = u.id
WHERE al.changed_by = 'user-uuid-here'
ORDER BY al.changed_at DESC
LIMIT 100;

-- 查看特定记录的变更历史
SELECT * FROM audit_logs
WHERE table_name = 'agents' AND record_id = 'agent-uuid-here'
ORDER BY changed_at DESC;

-- 统计操作频率
SELECT 
    table_name,
    operation,
    COUNT(*) as operation_count,
    DATE(changed_at) as operation_date
FROM audit_logs
WHERE changed_at >= NOW() - INTERVAL '30 days'
GROUP BY table_name, operation, DATE(changed_at)
ORDER BY operation_date DESC, operation_count DESC;
```

---

## 八、安全加固

### 8.1 访问控制矩阵

| 角色 | 权限 | 可访问数据库 | 操作限制 |
|------|------|--------------|----------|
| `agenthive_admin` | 超级用户 | 所有 | 无限制 |
| `agenthive_app` | 应用账户 | agenthive | 仅 DML |
| `agenthive_readonly` | 只读账户 | agenthive | 仅 SELECT |
| `agenthive_migrate` | 迁移账户 | agenthive | DDL + DML |
| `agenthive_backup` | 备份账户 | 所有 | pg_dump |
| `agenthive_replica` | 复制账户 | 所有 | 复制流 |

### 8.2 权限配置脚本

```sql
-- ============================================================================
-- 数据库用户权限配置
-- ============================================================================

-- 1. 应用账户
CREATE USER agenthive_app WITH PASSWORD '${APP_PASSWORD}';
GRANT CONNECT ON DATABASE agenthive TO agenthive_app;
GRANT USAGE ON SCHEMA public TO agenthive_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agenthive_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agenthive_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agenthive_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO agenthive_app;

-- 2. 只读账户
CREATE USER agenthive_readonly WITH PASSWORD '${READONLY_PASSWORD}';
GRANT CONNECT ON DATABASE agenthive TO agenthive_readonly;
GRANT USAGE ON SCHEMA public TO agenthive_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agenthive_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agenthive_readonly;

-- 3. 迁移账户
CREATE USER agenthive_migrate WITH PASSWORD '${MIGRATE_PASSWORD}';
GRANT CONNECT ON DATABASE agenthive TO agenthive_migrate;
GRANT CREATE ON DATABASE agenthive TO agenthive_migrate;
GRANT ALL ON SCHEMA public TO agenthive_migrate;
GRANT ALL ON ALL TABLES IN SCHEMA public TO agenthive_migrate;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO agenthive_migrate;

-- 4. 备份账户
CREATE USER agenthive_backup WITH PASSWORD '${BACKUP_PASSWORD}';
GRANT CONNECT ON DATABASE agenthive TO agenthive_backup;
GRANT USAGE ON SCHEMA public TO agenthive_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agenthive_backup;

-- 5. 复制账户
CREATE USER agenthive_replica WITH REPLICATION PASSWORD '${REPLICA_PASSWORD}';
GRANT CONNECT ON DATABASE agenthive TO agenthive_replica;

-- 6. 行级安全策略（示例：agents 表）
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_owner_policy ON agents
    FOR ALL TO agenthive_app
    USING (owner_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY agents_member_policy ON agents
    FOR SELECT TO agenthive_app
    USING (
        EXISTS (
            SELECT 1 FROM agent_members
            WHERE agent_id = agents.id
            AND user_id = current_setting('app.current_user_id')::UUID
        )
    );
```

### 8.3 连接加密

```yaml
# PostgreSQL TLS 配置
apiVersion: v1
kind: Secret
metadata:
  name: postgres-tls
  namespace: agenthive
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
  ca.crt: <base64-encoded-ca>
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-ssl-config
  namespace: agenthive
data:
  postgresql.conf: |
    ssl = on
    ssl_cert_file = '/var/lib/postgresql/tls/tls.crt'
    ssl_key_file = '/var/lib/postgresql/tls/tls.key'
    ssl_ca_file = '/var/lib/postgresql/tls/ca.crt'
    ssl_min_protocol_version = 'TLSv1.3'
    ssl_ciphers = 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384'
```

---

## 九、维护作业

### 9.1 定期维护任务

```yaml
# K8s CronJob - VACUUM ANALYZE
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-vacuum
  namespace: agenthive
spec:
  schedule: "0 3 * * 0"  # 每周日凌晨 3 点
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: vacuum
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              psql -h postgres -U agenthive -d agenthive -c "
                VACUUM (VERBOSE, ANALYZE) agents;
                VACUUM (VERBOSE, ANALYZE) tasks;
                VACUUM (VERBOSE, ANALYZE) projects;
                VACUUM (VERBOSE, ANALYZE) chat_messages;
              "
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: DB_PASSWORD

---
# K8s CronJob - 清理旧审计日志
apiVersion: batch/v1
kind: CronJob
metadata:
  name: audit-log-cleanup
  namespace: agenthive
spec:
  schedule: "0 4 1 * *"  # 每月 1 日凌晨 4 点
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              psql -h postgres -U agenthive -d agenthive -c "
                DELETE FROM audit_logs 
                WHERE changed_at < NOW() - INTERVAL '90 days';
              "
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: DB_PASSWORD
```

### 9.2 索引维护

```sql
-- 检查未使用的索引
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 重建索引（解决膨胀）
REINDEX INDEX CONCURRENTLY idx_agents_owner_id;

-- 更新统计信息
ANALYZE agents;
```

---

## 十、CI/CD 集成

### 10.1 GitHub Actions 工作流

```yaml
# .github/workflows/db-migrate.yaml
name: Database Migration

on:
  push:
    paths:
      - 'apps/api/src/db/migrations/**'
      - 'apps/java/*/src/main/resources/db/migration/**'
  pull_request:
    paths:
      - 'apps/api/src/db/migrations/**'

jobs:
  lint-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check migration file naming
        run: |
          for file in apps/api/src/db/migrations/*.sql; do
            if [[ ! $(basename $file) =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
              echo "Invalid migration file name: $file"
              echo "Expected format: YYYYMMDDHHMMSS_description.sql"
              exit 1
            fi
          done
      
      - name: Check for BEGIN/COMMIT
        run: |
          for file in apps/api/src/db/migrations/*.sql; do
            if ! grep -q "BEGIN;" $file || ! grep -q "COMMIT;" $file; then
              echo "Migration $file missing BEGIN/COMMIT"
              exit 1
            fi
          done

  test-migration:
    runs-on: ubuntu-latest
    needs: lint-migrations
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: agenthive_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npm run db:migrate
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: postgres
          DB_PASSWORD: test
          DB_NAME: agenthive_test
      
      - name: Verify schema
        run: |
          psql -h localhost -U postgres -d agenthive_test -c "
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
          "
      
      - name: Run rollback
        run: npm run db:rollback
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: postgres
          DB_PASSWORD: test
          DB_NAME: agenthive_test

  migrate-staging:
    runs-on: ubuntu-latest
    needs: test-migration
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1
      
      - name: Run migration on staging
        run: |
          kubectl exec deploy/api -n agenthive -- npm run db:migrate
        env:
          KUBECONFIG: ${{ secrets.KUBE_CONFIG_STAGING }}

  migrate-production:
    runs-on: ubuntu-latest
    needs: migrate-staging
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Create backup before migration
        run: |
          kubectl exec deploy/postgres-backup -n agenthive -- ./scripts/backup-pre-migration.sh
      
      - name: Run migration on production
        run: |
          kubectl exec deploy/api -n agenthive -- npm run db:migrate
        env:
          KUBECONFIG: ${{ secrets.KUBE_CONFIG_PRODUCTION }}
      
      - name: Verify migration
        run: |
          kubectl exec deploy/api -n agenthive -- npm run db:status
      
      - name: Notify on success
        uses: 8398a7/action-slack@v3
        with:
          status: success
          fields: repo,message,commit,author
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 十一、运维手册

### 11.1 日常巡检清单

| 检查项 | 频率 | 命令 | 阈值 |
|--------|------|------|------|
| 连接数 | 每小时 | `SELECT count(*) FROM pg_stat_activity;` | < 80% max_connections |
| 复制延迟 | 每小时 | `SELECT pg_wal_lsn_diff(sent_lsn, replay_lsn) FROM pg_stat_replication;` | < 1MB |
| 表膨胀 | 每日 | `SELECT n_dead_tup FROM pg_stat_user_tables;` | dead_ratio < 20% |
| 磁盘空间 | 每日 | `df -h /var/lib/postgresql` | < 85% |
| 慢查询 | 每日 | `SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;` | avg_time < 1s |
| 备份验证 | 每周 | `pg_verifybackup /var/backups/latest` | 通过 |

### 11.2 故障排查手册

**问题 1：连接池耗尽**

```bash
# 1. 检查当前连接
psql -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"

# 2. 查看长时间运行的查询
psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# 3. 终止空闲连接
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < NOW() - INTERVAL '10 minutes';"

# 4. 检查应用连接泄漏
kubectl logs deploy/api | grep "connection"
```

**问题 2：复制中断**

```bash
# 1. 检查复制状态
psql -c "SELECT * FROM pg_stat_replication;"

# 2. 重建复制槽
psql -c "SELECT pg_drop_replication_slot('standby_slot');"
psql -c "SELECT pg_create_physical_replication_slot('standby_slot');"

# 3. 重新同步 standby
pg_basebackup -h primary-host -U replicator -D /var/lib/postgresql/data -P -R
```

**问题 3：慢查询**

```bash
# 1. 启用 pg_stat_statements
psql -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# 2. 查看最慢的查询
psql -c "SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;"

# 3. 分析查询计划
psql -c "EXPLAIN ANALYZE <slow_query>;"

# 4. 创建索引
CREATE INDEX CONCURRENTLY idx_table_column ON table(column);
```

---

## 十二、实施路线图

### Phase 1: 基础设施（2 周）

- [ ] 部署 Patroni 高可用集群
- [ ] 配置 WAL 归档到 MinIO
- [ ] 部署 PgBouncer 连接池
- [ ] 配置 postgres_exporter 监控

### Phase 2: 迁移管理（1 周）

- [ ] 引入 node-pg-migrate
- [ ] 迁移现有 schema.sql 到版本化迁移
- [ ] 编写缺失的迁移脚本（agent.owner_id, task.user_id）
- [ ] 集成 CI/CD 自动迁移

### Phase 3: 安全加固（1 周）

- [ ] 实施行级安全策略（RLS）
- [ ] 配置 TLS 加密连接
- [ ] 创建最小权限账户
- [ ] 启用审计日志

### Phase 4: 备份恢复（1 周）

- [ ] 配置多级备份策略
- [ ] 部署跨区域复制
- [ ] 编写恢复演练脚本
- [ ] 定期恢复测试

### Phase 5: 运维自动化（持续）

- [ ] 编写运维手册
- [ ] 配置告警规则
- [ ] 建立 On-call 流程
- [ ] 定期维护作业自动化

---

## 附录

### A. 常用命令速查

```bash
# 连接数据库
psql -h localhost -U agenthive -d agenthive

# 查看表大小
psql -c "SELECT pg_size_pretty(pg_total_relation_size('agents'));"

# 查看索引使用情况
psql -c "SELECT indexname, idx_scan FROM pg_stat_user_indexes;"

# 导出数据
pg_dump -h localhost -U agenthive -d agenthive -t agents > agents.sql

# 恢复数据
psql -h localhost -U agenthive -d agenthive < agents.sql

# 创建备份
pg_dump -h localhost -U agenthive -d agenthive -F c -f agenthive.backup

# 恢复备份
pg_restore -h localhost -U agenthive -d agenthive agenthive.backup
```

### B. 参考文档

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/16/index.html)
- [Patroni 文档](https://patroni.readthedocs.io/)
- [PgBouncer 文档](https://www.pgbouncer.org/)
- [node-pg-migrate 文档](https://salsita.github.io/node-pg-migrate/)
- [PostgreSQL 监控最佳实践](https://www.postgresql.org/docs/16/monitoring.html)

---

**文档版本历史**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-05-02 | backend-team | 初始版本 |
