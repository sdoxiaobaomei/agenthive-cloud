#!/bin/bash
# ==========================================
# AgentHive Cloud - Restore Script
# ==========================================

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <backup_file>${NC}"
    echo ""
    echo "Available backups:"
    ls -1t ./backups/*.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will overwrite existing data!${NC}"
read -p "Are you sure you want to continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo -e "${BLUE}Restoring from: $BACKUP_FILE${NC}"

# Detect backup type
if [[ $BACKUP_FILE == *postgres* ]]; then
    echo -e "${BLUE}Restoring PostgreSQL...${NC}"
    gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql -U agenthive
    echo -e "${GREEN}✓ PostgreSQL restored${NC}"
elif [[ $BACKUP_FILE == *redis* ]]; then
    echo -e "${BLUE}Restoring Redis...${NC}"
    # Stop Redis, restore dump, start Redis
    docker-compose stop redis
    docker cp "$BACKUP_FILE" "$(docker-compose ps -q redis)":/data/dump.rdb
    docker-compose start redis
    echo -e "${GREEN}✓ Redis restored${NC}"
else
    echo -e "${RED}Unknown backup type${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Restore Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
