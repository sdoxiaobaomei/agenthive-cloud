# PostgreSQL 备份与恢复操作手册

> **关联 Ticket**: TICKET-P0-005  
> **备份策略**: 每日 02:00 UTC 自动全量逻辑备份（pg_dump）  
> **保留周期**: 本地 + MinIO 各保留 7 天  
> **加密方式**: AES-256-CBC（密钥通过环境变量/Secret 注入）

---

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ PostgreSQL  │────▶│   pg_dump   │────▶│ gzip + AES  │────▶│   MinIO     │
│  (7 个库)   │     │  逻辑备份   │     │  加密压缩   │     │ (对象存储)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 备份范围

| 数据库 | 用途 | 主机 | 端口 |
|--------|------|------|------|
| **agenthive** | Node API 主库 | postgres | 5432 |
| **auth_db** | Java 认证服务 | postgres | 5433 |
| **user_db** | Java 用户服务 | postgres | 5433 |
| **payment_db** | Java 支付服务 | postgres | 5433 |
| **order_db** | Java 订单服务 | postgres | 5433 |
| **cart_db** | Java 购物车服务 | postgres | 5433 |
| **logistics_db** | Java 物流服务 | postgres | 5433 |

---

## 自动备份（推荐）

### Docker 环境

```bash
# 1. 配置环境变量
cat >> .env.prod <<EOF
BACKUP_ENCRYPTION_KEY=your-strong-backup-key-32-chars-long
BACKUP_DIR=/var/backups/postgres
MINIO_ENDPOINT=http://minio:9000
MINIO_BUCKET=agenthive-backups
MINIO_ACCESS_KEY=minio-admin
MINIO_SECRET_KEY=minio-password
EOF

# 2. 测试备份
./scripts/backup-postgres.sh

# 3. 添加到 crontab（每日 02:00 UTC = 北京时间 10:00）
crontab -e
# 添加：
0 2 * * * cd /path/to/agenthive-cloud && ./scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1
```

### K8s 环境

```bash
# 部署 CronJob（K8s 上线后执行）
kubectl apply -f k8s/base/11-backup-cronjob.yaml

# 查看备份任务执行记录
kubectl get cronjob postgres-backup -n agenthive
kubectl get jobs -n agenthive | grep postgres-backup
```

---

## 手动备份

```bash
# 单库手动备份
PGPASSWORD=dev pg_dump -h localhost -U agenthive agenthive | gzip > agenthive_manual_$(date +%Y%m%d).sql.gz
```

---

## 恢复操作

### 从备份恢复指定数据库

```bash
# 语法: ./restore-postgres.sh <dbname> <backup_date> [host] [port]
./scripts/restore-postgres.sh agenthive 20260427_020000 localhost 5432

# 恢复 Java 微服务数据库
./scripts/restore-postgres.sh auth_db 20260427_020000 localhost 5433
```

恢复流程：
1. 本地查找备份文件，若不存在则从 MinIO 下载
2. AES-256 解密（需 `BACKUP_ENCRYPTION_KEY`）
3. 交互式确认（输入 `yes`）
4. 创建目标数据库（如不存在）
5. 执行 `psql` 恢复数据

### 紧急全量恢复（所有数据库）

```bash
BACKUP_DATE="20260427_020000"
for DB in agenthive auth_db user_db payment_db order_db cart_db logistics_db; do
    ./scripts/restore-postgres.sh "$DB" "$BACKUP_DATE" localhost 5432
done
```

> ⚠️ **警告**：恢复会覆盖目标数据库的现有数据，生产环境执行前务必确认备份日期正确。

---

## 备份文件结构

```
/var/backups/postgres/
├── agenthive_20260427_020000.sql.gz.enc
├── auth_db_20260427_020000.sql.gz.enc
├── user_db_20260427_020000.sql.gz.enc
├── ...
```

MinIO 路径：
```
agenthive-backups/postgres/<dbname>/<dbname>_YYYYMMDD_HHMMSS.sql.gz.enc
```

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `BACKUP_ENCRYPTION_KEY 未设置` | 环境变量缺失 | 配置 `.env` 或导出环境变量 |
| `pg_dump: connection refused` | PostgreSQL 未启动或端口错误 | 检查 `docker ps` 或 `kubectl get pods` |
| MinIO 上传失败 | mc/aws CLI 未安装或凭证错误 | 安装 MinIO Client 或检查 `MINIO_ACCESS_KEY` |
| 解密失败 | 密钥错误或文件损坏 | 确认 `BACKUP_ENCRYPTION_KEY` 与备份时一致 |

---

## 安全基线

- [x] 备份文件 AES-256 加密，无明文数据库转储留存
- [x] 加密密钥通过环境变量/Secret 注入，不硬编码在脚本中
- [x] 备份目录权限 `700`，仅 root/备份用户可访问
- [x] MinIO 凭证通过 Secret 管理（K8s）或 `.env` 文件（Docker）
- [x] 保留策略 7 天，过期备份自动清理
