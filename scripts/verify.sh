#!/bin/bash
# ==========================================
# AgentHive Cloud - Verification Script
# ==========================================

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  AgentHive Cloud - Verification${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if command -v docker >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    check_pass "Docker installed ($DOCKER_VERSION)"
else
    check_fail "Docker not installed"
fi

if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | tr -d ',')
    check_pass "Docker Compose installed ($COMPOSE_VERSION)"
else
    check_fail "Docker Compose not installed"
fi

if command -v make >/dev/null 2>&1; then
    check_pass "Make installed"
else
    check_warn "Make not installed (optional)"
fi

echo ""

# Check Docker is running
echo -e "${BLUE}Checking Docker daemon...${NC}"
if docker info >/dev/null 2>&1; then
    check_pass "Docker daemon is running"
else
    check_fail "Docker daemon is not running"
    exit 1
fi

echo ""

# Check environment file
echo -e "${BLUE}Checking configuration...${NC}"
if [ -f .env ]; then
    check_pass ".env file exists"
else
    check_fail ".env file missing (run: cp .env.example .env)"
fi

if [ -f docker-compose.yml ]; then
    check_pass "docker-compose.yml exists"
else
    check_fail "docker-compose.yml missing"
fi

if [ -f Makefile ]; then
    check_pass "Makefile exists"
else
    check_warn "Makefile missing"
fi

echo ""

# Check services
echo -e "${BLUE}Checking services...${NC}"

# PostgreSQL
if docker-compose ps | grep -q "postgres.*Up"; then
    check_pass "PostgreSQL is running"
    if docker-compose exec -T postgres pg_isready -U agenthive >/dev/null 2>&1; then
        check_pass "PostgreSQL is accepting connections"
    else
        check_fail "PostgreSQL is not accepting connections"
    fi
else
    check_warn "PostgreSQL is not running"
fi

# Redis
if docker-compose ps | grep -q "redis.*Up"; then
    check_pass "Redis is running"
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        check_pass "Redis is responding"
    else
        check_fail "Redis is not responding"
    fi
else
    check_warn "Redis is not running"
fi

# Supervisor API
if docker-compose ps | grep -q "supervisor.*Up"; then
    check_pass "Supervisor API is running"
    if curl -s http://localhost:8080/health | grep -q "healthy"; then
        check_pass "Supervisor API health check passed"
    else
        check_fail "Supervisor API health check failed"
    fi
else
    check_warn "Supervisor API is not running"
fi

# Web Frontend
if docker-compose ps | grep -q "web.*Up"; then
    check_pass "Web frontend is running"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/health | grep -q "200"; then
        check_pass "Web frontend health check passed"
    else
        check_fail "Web frontend health check failed"
    fi
else
    check_warn "Web frontend is not running"
fi

echo ""

# Check ports
echo -e "${BLUE}Checking ports...${NC}"
for port in 5432 6379 8080 5173; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        check_pass "Port $port is listening"
    else
        check_warn "Port $port is not listening"
    fi
done

echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo -e "Your AgentHive Cloud environment is ready!"
    echo -e "  - Web UI: ${YELLOW}http://localhost:5173${NC}"
    echo -e "  - API: ${YELLOW}http://localhost:8080${NC}"
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Failed: ${RED}$CHECKS_FAILED${NC}"
    echo ""
    echo -e "Please review the failures above and fix them."
    exit 1
fi
echo -e "${BLUE}============================================${NC}"
