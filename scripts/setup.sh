#!/bin/bash
# ==========================================
# AgentHive Cloud - Setup Script
# ==========================================

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  AgentHive Cloud - Setup Script${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Docker Compose is required but not installed. Aborting.${NC}" >&2; exit 1; }

echo -e "${GREEN}✓ Docker found${NC}"
echo -e "${GREEN}✓ Docker Compose found${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please review and update .env with your configuration${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi
echo ""

# Create necessary directories
echo -e "${BLUE}Creating necessary directories...${NC}"
mkdir -p logs data/postgres data/redis data/minio
chmod 755 logs data data/postgres data/redis data/minio
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Pull images
echo -e "${BLUE}Pulling Docker images...${NC}"
docker-compose pull
echo -e "${GREEN}✓ Images pulled${NC}"
echo ""

# Build images
echo -e "${BLUE}Building application images...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✓ Images built${NC}"
echo ""

# Setup complete
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Next steps:"
echo ""
echo -e "  1. ${YELLOW}Review .env file${NC} and update configuration"
echo -e "  2. Start services: ${YELLOW}make dev-docker${NC}"
echo -e "  3. Access web UI: ${YELLOW}http://localhost:5173${NC}"
echo -e "  4. View logs: ${YELLOW}make logs${NC}"
echo ""
echo -e "For more information, see ${YELLOW}DEPLOYMENT.md${NC}"
echo ""
