#!/bin/bash
# ============================================================================
# init-data-layer.sh — 2C2G 数据层一键初始化
# 用途: 在 2C2G 阿里云服务器上部署 PG + Redis，服务 Staging + Production
# 前提: Docker + Docker Compose 已安装
# 用法: bash init-data-layer.sh
# ============================================================================

set -euo pipefail

# ---- 配置 ----
PG_PASS_STAGING="${PG_PASS_STAGING:-staging_changeme}"
PG_PASS_PROD="${PG_PASS_PROD:-prod_changeme}"
REDIS_PASSWORD="${REDIS_PASSWORD:-redis_changeme}"
BACKUP_OSS_PATH="${BACKUP_OSS_PATH:-}"  # oss://bucket/pg-backups/ 留空则只本地备份
DATA_DIR="/data/agenthive"
BACKUP_DIR="/data/backups"

echo "========================================"
echo "  AgentHive 数据层初始化"
echo "  目录: ${DATA_DIR}"
echo "========================================"

# ---- 创建目录 ----
mkdir -p "${DATA_DIR}/postgres" "${DATA_DIR}/redis" "${BACKUP_DIR}"

# ---- PG 初始化脚本 (创建多数据库) ----
cat > "${DATA_DIR}/init-db.sh" << 'EOSQL'
#!/bin/bash
set -e

# Staging databases
for DB in agent chat project user; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
    CREATE DATABASE staging_${DB};
    CREATE USER staging_${DB} WITH PASSWORD '${PG_PASS_STAGING}';
    GRANT ALL PRIVILEGES ON DATABASE staging_${DB} TO staging_${DB};
SQL
done

# Production databases
for DB in agent chat project user; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
    CREATE DATABASE prod_${DB};
    CREATE USER prod_${DB} WITH PASSWORD '${PG_PASS_PROD}';
    GRANT ALL PRIVILEGES ON DATABASE prod_${DB} TO prod_${DB};
SQL
done

echo "✅ 8 databases created (4 staging + 4 production)"
EOSQL

chmod +x "${DATA_DIR}/init-db.sh"

# ---- Docker Compose ----
cat > "${DATA_DIR}/docker-compose.yml" << 'EOF'
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    container_name: agenthive-pg
    restart: always
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${PG_SUPER_PASSWORD:-super_changeme}
      PG_PASS_STAGING: ${PG_PASS_STAGING:-staging_changeme}
      PG_PASS_PROD: ${PG_PASS_PROD:-prod_changeme}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    command: >
      postgres
        -c shared_buffers=512MB
        -c work_mem=16MB
        -c maintenance_work_mem=128MB
        -c max_connections=50
        -c statement_timeout=30000
        -c log_rotation_age=1d
        -c log_rotation_size=50MB
        -c log_min_duration_statement=500
    deploy:
      resources:
        limits:
          memory: 1024M

  redis:
    image: redis:7-alpine
    container_name: agenthive-redis
    restart: always
    ports:
      - "6379:6379"
    command: >
      redis-server
        --requirepass ${REDIS_PASSWORD:-redis_changeme}
        --maxmemory 128mb
        --maxmemory-policy allkeys-lru
        --databases 4
    volumes:
      - redisdata:/data
    deploy:
      resources:
        limits:
          memory: 192M

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
EOF

# ---- 启动 ----
cd "${DATA_DIR}"
docker compose up -d

echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec agenthive-pg pg_isready -U postgres &>/dev/null; do
  sleep 2
done
echo "✅ PostgreSQL is ready"

# ---- 备份定时任务 ----
cat > "${DATA_DIR}/backup.sh" << 'BACKUP'
#!/bin/bash
set -euo pipefail
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR="/data/backups"
mkdir -p "${BACKUP_DIR}"

# pg_dumpall
docker exec agenthive-pg pg_dumpall -U postgres | gzip > "${BACKUP_DIR}/pg_all_${DATE}.sql.gz"

# 保留最近 7 天
find "${BACKUP_DIR}" -name "pg_all_*.sql.gz" -mtime +7 -delete

echo "✅ Backup completed: pg_all_${DATE}.sql.gz"

# 如果配置了 OSS，上传备份
if [ -n "${BACKUP_OSS_PATH:-}" ] && command -v ossutil64 &>/dev/null; then
  ossutil64 cp "${BACKUP_DIR}/pg_all_${DATE}.sql.gz" "${BACKUP_OSS_PATH}/pg_all_${DATE}.sql.gz"
  echo "✅ Uploaded to OSS"
fi
BACKUP

chmod +x "${DATA_DIR}/backup.sh"

# 添加 cron (每天凌晨 3 点)
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "0 3 * * * /bin/bash ${DATA_DIR}/backup.sh >> ${BACKUP_DIR}/backup.log 2>&1") | crontab -

echo ""
echo "========================================"
echo "  ✅ 数据层初始化完成"
echo "========================================"
echo ""
echo "连接信息:"
echo "  PostgreSQL: <服务器IP>:5432"
echo "    Staging:  staging_agent / staging_chat / staging_project / staging_user"
echo "    Prod:     prod_agent / prod_chat / prod_project / prod_user"
echo ""
echo "  Redis: <服务器IP>:6379"
echo "    Staging: db0"
echo "    Prod:    db1"
echo ""
echo "  备份: 每日 03:00 → ${BACKUP_DIR}/"
echo "  手动备份: bash ${DATA_DIR}/backup.sh"
echo ""
echo "⚠️  请修改以下默认密码:"
echo "  - PG_SUPER_PASSWORD (postgres 超级用户)"
echo "  - PG_PASS_STAGING"
echo "  - PG_PASS_PROD"
echo "  - REDIS_PASSWORD"
