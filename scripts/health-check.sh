#!/bin/bash
# ==========================================
# AgentHive Cloud - Health Check Script
# ==========================================
# Validates that all services are running and accessible
#
# Usage:
#   ./scripts/health-check.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# ==========================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Load environment variables
load_env() {
    if [ -f "$ENV_FILE" ]; then
        # Export variables from .env file
        set -a
        source "$ENV_FILE"
        set +a
    fi
    
    # Set defaults
    WEB_PORT="${WEB_PORT:-5173}"
    SUPERVISOR_PORT="${SUPERVISOR_PORT:-8080}"
    DB_PORT="${DB_PORT:-5432}"
    REDIS_PORT="${REDIS_PORT:-6379}"
}

# Helper functions
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
    ((CHECKS_WARNING++))
}

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  AgentHive Cloud - Health Check${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}$(printf '%*s' "${#1}" '' | tr ' ' '=')${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker
check_docker() {
    print_section "Docker Environment"
    
    if command_exists docker; then
        local version=$(docker --version | cut -d' ' -f3 | tr -d ',')
        check_pass "Docker installed ($version)"
    else
        check_fail "Docker not installed"
        return 1
    fi
    
    if docker info >/dev/null 2>&1; then
        check_pass "Docker daemon is running"
        
        # Check Docker Desktop specific
        if docker info 2>/dev/null | grep -q "Desktop"; then
            check_pass "Docker Desktop detected"
        fi
    else
        check_fail "Docker daemon is not running"
        return 1
    fi
    
    # Check Docker Compose
    if docker compose version >/dev/null 2>&1 || docker-compose version >/dev/null 2>&1; then
        check_pass "Docker Compose available"
    else
        check_fail "Docker Compose not available"
    fi
}

# Check containers
check_containers() {
    print_section "Container Status"
    
    local containers=("agenthive-postgres" "agenthive-redis" "agenthive-supervisor-dev" "agenthive-web-dev")
    local all_running=true
    
    for container in "${containers[@]}"; do
        if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
            local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "N/A")
            
            if [ "$status" = "running" ]; then
                if [ "$health" = "N/A" ] || [ "$health" = "healthy" ]; then
                    check_pass "$container is running (health: $health)"
                else
                    check_warn "$container is running but health is: $health"
                fi
            else
                check_fail "$container status: $status"
                all_running=false
            fi
        else
            check_fail "$container is not running"
            all_running=false
        fi
    done
    
    $all_running
}

# Check ports
check_ports() {
    print_section "Port Availability"
    
    local ports=(
        "$WEB_PORT:Web Frontend"
        "$SUPERVISOR_PORT:Supervisor API"
        "$DB_PORT:PostgreSQL"
        "$REDIS_PORT:Redis"
    )
    
    for port_info in "${ports[@]}"; do
        IFS=':' read -r port name <<< "$port_info"
        
        if command_exists lsof; then
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                check_pass "Port $port ($name) is listening"
            else
                check_fail "Port $port ($name) is not listening"
            fi
        elif command_exists netstat; then
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                check_pass "Port $port ($name) is listening"
            else
                check_fail "Port $port ($name) is not listening"
            fi
        elif command_exists ss; then
            if ss -tuln 2>/dev/null | grep -q ":$port "; then
                check_pass "Port $port ($name) is listening"
            else
                check_fail "Port $port ($name) is not listening"
            fi
        else
            check_warn "Cannot check port $port (no suitable tool found)"
        fi
    done
}

# Check HTTP endpoints
check_http_endpoints() {
    print_section "HTTP Endpoints"
    
    local check_endpoint() {
        local url=$1
        local name=$2
        local expected_code=${3:-200}
        
        if command_exists curl; then
            local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
            if [ "$response" = "$expected_code" ]; then
                check_pass "$name ($url) - HTTP $response"
                return 0
            else
                check_fail "$name ($url) - HTTP $response (expected $expected_code)"
                return 1
            fi
        elif command_exists wget; then
            if wget --spider -q "$url" 2>/dev/null; then
                check_pass "$name ($url) - accessible"
                return 0
            else
                check_fail "$name ($url) - not accessible"
                return 1
            fi
        else
            check_warn "Cannot check $name (no HTTP client found)"
            return 1
        fi
    }
    
    # Check Web Frontend
    check_endpoint "http://localhost:$WEB_PORT/" "Web Frontend" || true
    
    # Check API Health
    check_endpoint "http://localhost:$SUPERVISOR_PORT/health" "API Health" || true
    
    # Check API Agents endpoint
    local agents_response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$SUPERVISOR_PORT/api/agents" 2>/dev/null || echo "000")
    if [ "$agents_response" = "200" ] || [ "$agents_response" = "401" ] || [ "$agents_response" = "403" ]; then
        check_pass "API Agents endpoint - HTTP $agents_response"
    else
        check_warn "API Agents endpoint - HTTP $agents_response (may need authentication)"
    fi
}

# Check database connectivity
check_database() {
    print_section "Database Connectivity"
    
    # Check PostgreSQL
    if docker ps --format "{{.Names}}" | grep -q "agenthive-postgres"; then
        local db_user="${DB_USER:-agenthive}"
        local db_name="${DB_NAME:-agenthive_local}"
        
        if docker exec agenthive-postgres pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
            check_pass "PostgreSQL is accepting connections"
            
            # Try to get database version
            local pg_version=$(docker exec agenthive-postgres psql -U "$db_user" -d "$db_name" -t -c "SELECT version();" 2>/dev/null | head -1 | tr -d ' ')
            if [ -n "$pg_version" ]; then
                check_pass "PostgreSQL query successful"
            fi
        else
            check_fail "PostgreSQL is not accepting connections"
        fi
    else
        check_fail "PostgreSQL container is not running"
    fi
    
    # Check Redis
    if docker ps --format "{{.Names}}" | grep -q "agenthive-redis"; then
        local redis_password="${REDIS_PASSWORD:-redis_local_secret}"
        
        if docker exec agenthive-redis redis-cli -a "$redis_password" ping 2>/dev/null | grep -q "PONG"; then
            check_pass "Redis is responding to PING"
        else
            check_fail "Redis is not responding"
        fi
    else
        check_fail "Redis container is not running"
    fi
}

# Check volumes
check_volumes() {
    print_section "Data Persistence"
    
    local volumes=("agenthive-cloud_postgres_data" "agenthive-cloud_redis_data" "agenthive-cloud_supervisor_logs")
    
    for volume in "${volumes[@]}"; do
        if docker volume ls --format "{{.Name}}" | grep -q "^${volume}$"; then
            local size=$(docker volume inspect --format='{{.UsageData.Size}}' "$volume" 2>/dev/null || echo "unknown")
            check_pass "Volume $volume exists"
        else
            check_warn "Volume $volume not found (will be created on start)"
        fi
    done
}

# Check resource usage
check_resources() {
    print_section "Resource Usage"
    
    if docker ps --format "{{.Names}}" | grep -q "agenthive-"; then
        echo ""
        echo -e "${CYAN}Container Resource Usage:${NC}"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}" 2>/dev/null | grep "agenthive-" || true
    fi
}

# Print summary
print_summary() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  Health Check Summary${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo -e "Checks passed:   ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Checks failed:   ${RED}$CHECKS_FAILED${NC}"
    echo -e "Warnings:        ${YELLOW}$CHECKS_WARNING${NC}"
    echo ""
    
    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All critical checks passed!${NC}"
        echo ""
        echo -e "Your AgentHive Cloud environment is ready:"
        echo -e "  ${CYAN}Web UI:${NC}  ${YELLOW}http://localhost:$WEB_PORT${NC}"
        echo -e "  ${CYAN}API:${NC}     ${YELLOW}http://localhost:$SUPERVISOR_PORT${NC}"
        echo -e "  ${CYAN}API Docs:${NC} ${YELLOW}http://localhost:$SUPERVISOR_PORT/swagger/index.html${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ Some checks failed${NC}"
        echo ""
        echo -e "Please review the failures above and:"
        echo -e "  1. Ensure all services are running: ${YELLOW}./scripts/local-docker.sh start${NC}"
        echo -e "  2. Check logs: ${YELLOW}./scripts/local-docker.sh logs${NC}"
        echo -e "  3. Review the Docker Desktop dashboard"
        echo ""
        return 1
    fi
}

# Main execution
main() {
    load_env
    print_header
    
    check_docker
    check_containers
    check_ports
    check_http_endpoints
    check_database
    check_volumes
    check_resources
    
    print_summary
    exit $CHECKS_FAILED
}

# Run main function
main "$@"
