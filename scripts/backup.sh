#!/bin/bash
# ==========================================
# AgentHive Cloud - Backup Script
# ==========================================

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}Starting backup...${NC}"

# Backup PostgreSQL
echo -e "${BLUE}Backing up PostgreSQL...${NC}"
docker-compose exec -T postgres pg_dumpall -c -U agenthive > "$BACKUP_DIR/postgres_$TIMESTAMP.sql"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PostgreSQL backup completed${NC}"
    gzip "$BACKUP_DIR/postgres_$TIMESTAMP.sql"
else
    echo -e "${RED}✗ PostgreSQL backup failed${NC}"
    exit 1
fi

# Backup Redis
echo -e "${BLUE}Backing up Redis...${NC}"
docker-compose exec -T redis redis-cli BGSAVE
sleep 2
docker cp "$(docker-compose ps -q redis)":/data/dump.rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Redis backup completed${NC}"
    gzip "$BACKUP_DIR/redis_$TIMESTAMP.rdb"
else
    echo -e "${RED}✗ Redis backup failed${NC}"
fi

# Backup configuration
echo -e "${BLUE}Backing up configuration...${NC}"
tar -czf "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" .env config/ 2>/dev/null || true
echo -e "${GREEN}✓ Configuration backup completed${NC}"

# Cleanup old backups
echo -e "${BLUE}Cleaning up old backups...${NC}"
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
echo -e "${GREEN}✓ Cleanup completed${NC}"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Backup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Backup location: ${YELLOW}$BACKUP_DIR${NC}"
ls -lh "$BACKUP_DIR"
