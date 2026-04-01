#!/bin/bash
# ==========================================
# AgentHive Cloud - Docker Desktop Verification Script
# ==========================================
# Comprehensive verification for Docker Desktop local deployment
#
# Usage:
#   ./scripts/verify-docker-desktop.sh
#
# This script verifies:
#   - Docker Desktop environment compatibility
#   - Required ports availability
#   - Configuration files
#   - Service endpoints
#   - Hot reload functionality
# ==========================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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
    echo -e "${BLUE}  AgentHive Cloud - Docker Desktop Verify${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}$(printf '%*s' "${#1}" '' | tr ' ' '=')${NC}"
}

# Check Docker Desktop Environment
check_docker_desktop() {
    print_section "Docker Desktop Environment"
    
    # Check Docker version
    if command -v docker >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        check_pass "Docker installed ($DOCKER_VERSION)"
        
        # Check minimum version
        MAJOR=$(echo $DOCKER_VERSION | cut -d. -f1)
        if [ "$MAJOR" -ge "20" ]; then
            check_pass "Docker version meets minimum requirements"
        else
            check_warn "Docker version may be outdated"
        fi
    else
        check_fail "Docker not installed"
        return 1
    fi
    
    # Check Docker is running
    if docker info >/dev/null 2>&1; then
        check_pass "Docker daemon is running"
        
        # Check Docker Desktop specific
        if docker info 2>/dev/null | grep -q "Desktop"; then
            check_pass "Docker Desktop detected"
            
            # Check WSL2 backend on Windows
            if docker info 2>/dev/null | grep -q "wsl2"; then
                check_pass "WSL2 backend detected"
            fi
        fi
    else
        check_fail "Docker daemon is not running"
        return 1
    fi
    
    # Check Docker Compose
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version | cut -d' ' -f4)
        check_pass "Docker Compose V2 installed ($COMPOSE_VERSION)"
    elif docker-compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker-compose version | cut -d' ' -f3 | tr -d ',')
        check_pass "Docker Compose installed ($COMPOSE_VERSION)"
    else
        check_fail "Docker Compose not installed"
        return 1
    fi
    
    # Check BuildKit
    if docker buildx version >/dev/null 2>&1; then
        check_pass "Docker BuildKit available"
    else
        check_warn "Docker BuildKit not available"
    fi
}

# Check Configuration Files
check_configuration() {
    print_section "Configuration Files"
    
    # Check docker-compose.yml
    if [ -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
        check_pass "docker-compose.yml exists"
        
        # Validate syntax
        if docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" config >/dev/null 2>&1; then
            check_pass "docker-compose.yml syntax is valid"
        else
            check_fail "docker-compose.yml has syntax errors"
        fi
    else
        check_fail "docker-compose.yml missing"
    fi
    
    # Check docker-compose.override.yml
    if [ -f "${PROJECT_ROOT}/docker-compose.override.yml" ]; then
        check_pass "docker-compose.override.yml exists"
    else
        check_warn "docker-compose.override.yml missing (optional)"
    fi
    
    # Check environment files
    if [ -f "${PROJECT_ROOT}/.env.local" ]; then
        check_pass ".env.local template exists"
    else
        check_fail ".env.local template missing"
    fi
    
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        check_pass ".env file exists"
    else
        check_warn ".env file missing (run: cp .env.local .env)"
    fi
    
    # Check scripts
    if [ -f "${PROJECT_ROOT}/scripts/local-docker.sh" ]; then
        check_pass "local-docker.sh script exists"
        if [ -x "${PROJECT_ROOT}/scripts/local-docker.sh" ]; then
            check_pass "local-docker.sh is executable"
        else
            check_warn "local-docker.sh is not executable"
        fi
    else
        check_fail "local-docker.sh script missing"
    fi
    
    if [ -f "${PROJECT_ROOT}/scripts/health-check.sh" ]; then
        check_pass "health-check.sh script exists"
    else
        check_fail "health-check.sh script missing"
    fi
}

# Check Port Availability
check_ports() {
    print_section "Port Availability"
    
    local ports=("5432:PostgreSQL" "6379:Redis" "8080:Supervisor API" "5173:Web Frontend")
    local all_available=true
    
    for port_info in "${ports[@]}"; do
        IFS=':' read -r port name <<< "$port_info"
        
        # Try to check port using different methods
        local port_in_use=false
        
        if command -v lsof >/dev/null 2>&1; then
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                port_in_use=true
            fi
        elif command -v netstat >/dev/null 2>&1; then
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                port_in_use=true
            fi
        elif command -v ss >/dev/null 2>&1; then
            if ss -tuln 2>/dev/null | grep -q ":$port "; then
                port_in_use=true
            fi
        elif command -v Get-NetTCPConnection >/dev/null 2>&1; then
            # PowerShell on Windows
            if powershell -Command "Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { \$_.State -eq 'Listen' }" 2>/dev/null | grep -q "."; then
                port_in_use=true
            fi
        fi
        
        if $port_in_use; then
            check_warn "Port $port is already in use (required by $name)"
            all_available=false
        else
            check_pass "Port $port is available ($name)"
        fi
    done
    
    $all_available
}

# Check Docker Network
check_network() {
    print_section "Docker Network"
    
    # Check if network exists
    if docker network ls | grep -q "agenthive-network"; then
        check_pass "agenthive-network exists"
        
        # Check network configuration
        local subnet=$(docker network inspect agenthive-network 2>/dev/null | grep -o '"Subnet": "[^"]*"' | head -1 | cut -d'"' -f4)
        if [ -n "$subnet" ]; then
            check_pass "Network subnet: $subnet"
        fi
    else
        check_warn "agenthive-network does not exist (will be created on start)"
    fi
}

# Check Volumes
check_volumes() {
    print_section "Docker Volumes"
    
    local volumes=("postgres_data" "redis_data" "supervisor_logs")
    
    for volume in "${volumes[@]}"; do
        local full_name="agenthive-cloud_${volume}"
        if docker volume ls --format "{{.Name}}" | grep -q "^${full_name}$"; then
            check_pass "Volume $volume exists"
        else
            check_warn "Volume $volume does not exist (will be created on start)"
        fi
    done
}

# Check Images
check_images() {
    print_section "Docker Images"
    
    local required_images=("postgres:16-alpine" "redis:7-alpine" "node:20-alpine" "golang:1.22-alpine")
    
    for image in "${required_images[@]}"; do
        if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image}$"; then
            check_pass "Image $image pulled"
        else
            check_warn "Image $image not found (will be pulled on start)"
        fi
    done
}

# Check Resource Limits
check_resources() {
    print_section "Resource Limits"
    
    # Try to get Docker system info
    local total_memory=$(docker system info 2>/dev/null | grep "Total Memory" | awk '{print $3}')
    if [ -n "$total_memory" ]; then
        check_pass "Docker memory: $total_memory"
        
        # Check if memory is sufficient (at least 4GB)
        local memory_gb=$(echo $total_memory | sed 's/GiB//;s/GB//')
        if (( $(echo "$memory_gb >= 4" | bc -l 2>/dev/null || echo "0") )); then
            check_pass "Memory is sufficient for local development"
        else
            check_warn "Memory may be insufficient (recommend 8GB+)"
        fi
    fi
    
    # Check disk space
    local disk_usage=$(docker system df 2>/dev/null | grep "Images" | awk '{print $4}')
    if [ -n "$disk_usage" ]; then
        check_pass "Docker disk usage: $disk_usage"
    fi
}

# Test Endpoints (if services are running)
test_endpoints() {
    print_section "Service Endpoints"
    
    # Check if services are running
    local services_running=false
    if docker ps --format "{{.Names}}" | grep -q "agenthive-"; then
        services_running=true
    fi
    
    if $services_running; then
        check_pass "AgentHive services are running"
        
        # Test web frontend
        if command -v curl >/dev/null 2>&1; then
            local web_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null || echo "000")
            if [ "$web_status" = "200" ]; then
                check_pass "Web frontend is accessible (HTTP 200)"
            else
                check_warn "Web frontend returned HTTP $web_status"
            fi
            
            # Test API health
            local api_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null || echo "000")
            if [ "$api_status" = "200" ]; then
                check_pass "API health endpoint is accessible (HTTP 200)"
                
                # Test API agents endpoint
                local agents_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/agents 2>/dev/null || echo "000")
                if [ "$agents_status" = "200" ]; then
                    check_pass "API agents endpoint is accessible (HTTP 200)"
                else
                    check_warn "API agents endpoint returned HTTP $agents_status"
                fi
            else
                check_warn "API health endpoint returned HTTP $api_status"
            fi
        else
            check_warn "curl not available, skipping endpoint tests"
        fi
    else
        check_warn "AgentHive services not running, skipping endpoint tests"
        echo ""
        echo -e "${CYAN}To start services, run:${NC}"
        echo "  ./scripts/local-docker.sh start"
    fi
}

# Print Summary
print_summary() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  Verification Summary${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo -e "Checks passed:   ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Checks failed:   ${RED}$CHECKS_FAILED${NC}"
    echo -e "Warnings:        ${YELLOW}$CHECKS_WARNING${NC}"
    echo ""
    
    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ Docker Desktop environment is ready!${NC}"
        echo ""
        echo -e "Next steps:"
        echo -e "  1. ${YELLOW}cp .env.local .env${NC}"
        echo -e "  2. ${YELLOW}./scripts/local-docker.sh start${NC}"
        echo -e "  3. ${YELLOW}./scripts/health-check.sh${NC}"
        echo ""
        echo -e "Services will be available at:"
        echo -e "  ${CYAN}Web UI:${NC}  ${YELLOW}http://localhost:5173${NC}"
        echo -e "  ${CYAN}API:${NC}     ${YELLOW}http://localhost:8080${NC}"
        return 0
    else
        echo -e "${RED}✗ Some checks failed${NC}"
        echo ""
        echo -e "Please review the failures above and fix them before starting services."
        return 1
    fi
}

# Main execution
main() {
    cd "$PROJECT_ROOT"
    print_header
    
    check_docker_desktop
    check_configuration
    check_ports
    check_network
    check_volumes
    check_images
    check_resources
    test_endpoints
    
    print_summary
    exit $CHECKS_FAILED
}

# Run main function
main "$@"
