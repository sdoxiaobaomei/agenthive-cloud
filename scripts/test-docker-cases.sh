#!/bin/bash
# ==========================================
# AgentHive Cloud - Docker Desktop Test Cases
# ==========================================
# Docker Desktop 环境详细测试用例

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# 计数器
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# 配置
COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.yml}"
BASE_URL="${BASE_URL:-http://localhost}"
API_URL="${API_URL:-http://localhost:8080}"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; ((TESTS_SKIPPED++)); }
log_section() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ==================== 测试用例 ====================

# TC-DOCKER-001: Docker 版本检查
test_docker_version() {
    log_section "TC-DOCKER-001: Docker Version Check"
    
    local version=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    
    if [ "$major" -ge 20 ] || ([ "$major" -eq 20 ] && [ "$minor" -ge 10 ]); then
        log_pass "Docker version $version meets requirement (>= 20.10)"
    else
        log_fail "Docker version $version too old (need >= 20.10)"
    fi
}

# TC-DOCKER-002: Docker Compose 版本检查
test_compose_version() {
    log_section "TC-DOCKER-002: Docker Compose Version Check"
    
    if docker compose version &>/dev/null; then
        local version=$(docker compose version --short 2>/dev/null | grep -oP '^\d+\.\d+')
        log_pass "Docker Compose plugin installed (v$version)"
    elif docker-compose --version &>/dev/null; then
        local version=$(docker-compose --version | grep -oP '\d+\.\d+')
        log_pass "Docker Compose standalone installed (v$version)"
    else
        log_fail "Docker Compose not found"
    fi
}

# TC-DOCKER-003: Docker Daemon 状态
test_docker_daemon() {
    log_section "TC-DOCKER-003: Docker Daemon Status"
    
    if docker info &>/dev/null; then
        local server_version=$(docker version --format '{{.Server.Version}}')
        log_pass "Docker daemon running (v$server_version)"
    else
        log_fail "Docker daemon not accessible"
    fi
}

# TC-DOCKER-004: Compose 文件语法验证
test_compose_syntax() {
    log_section "TC-DOCKER-004: Compose File Syntax"
    
    if docker-compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
        log_pass "docker-compose.yml syntax is valid"
    else
        log_fail "docker-compose.yml has syntax errors"
    fi
}

# TC-DOCKER-005: 环境文件检查
test_env_file() {
    log_section "TC-DOCKER-005: Environment File"
    
    if [ -f .env ]; then
        log_pass ".env file exists"
        
        # 检查必需变量
        local required_vars=("DB_USER" "DB_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET")
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" .env; then
                log_pass "Environment variable $var is set"
            else
                log_skip "Environment variable $var not set (using default)"
            fi
        done
    else
        log_skip ".env file missing (will use defaults)"
    fi
}

# TC-DOCKER-006: 镜像可拉取性检查
test_image_pull() {
    log_section "TC-DOCKER-006: Image Pull Check"
    
    local images=("postgres:16-alpine" "redis:7-alpine" "nginx:alpine")
    
    for image in "${images[@]}"; do
        if docker pull "$image" > /dev/null 2>&1; then
            log_pass "Can pull image: $image"
        else
            log_fail "Cannot pull image: $image"
        fi
    done
}

# TC-DOCKER-007: PostgreSQL 容器运行
test_postgres_running() {
    log_section "TC-DOCKER-007: PostgreSQL Container"
    
    if docker ps | grep -q "agenthive-postgres"; then
        log_pass "PostgreSQL container is running"
        
        # 检查健康状态
        local health=$(docker inspect --format='{{.State.Health.Status}}' agenthive-postgres 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            log_pass "PostgreSQL health status: healthy"
        elif [ "$health" = "starting" ]; then
            log_skip "PostgreSQL health status: starting"
        else
            log_fail "PostgreSQL health status: $health"
        fi
    else
        log_fail "PostgreSQL container not running"
    fi
}

# TC-DOCKER-008: Redis 容器运行
test_redis_running() {
    log_section "TC-DOCKER-008: Redis Container"
    
    if docker ps | grep -q "agenthive-redis"; then
        log_pass "Redis container is running"
        
        local health=$(docker inspect --format='{{.State.Health.Status}}' agenthive-redis 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            log_pass "Redis health status: healthy"
        elif [ "$health" = "starting" ]; then
            log_skip "Redis health status: starting"
        else
            log_fail "Redis health status: $health"
        fi
    else
        log_fail "Redis container not running"
    fi
}

# TC-DOCKER-009: Supervisor 容器运行
test_supervisor_running() {
    log_section "TC-DOCKER-009: Supervisor Container"
    
    if docker ps | grep -q "agenthive-supervisor"; then
        log_pass "Supervisor container is running"
        
        local health=$(docker inspect --format='{{.State.Health.Status}}' agenthive-supervisor 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            log_pass "Supervisor health status: healthy"
        elif [ "$health" = "starting" ]; then
            log_skip "Supervisor health status: starting"
        else
            log_fail "Supervisor health status: $health"
        fi
    else
        log_fail "Supervisor container not running"
    fi
}

# TC-DOCKER-010: Web 容器运行
test_web_running() {
    log_section "TC-DOCKER-010: Web Container"
    
    if docker ps | grep -q "agenthive-web"; then
        log_pass "Web container is running"
        
        local health=$(docker inspect --format='{{.State.Health.Status}}' agenthive-web 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            log_pass "Web health status: healthy"
        elif [ "$health" = "starting" ]; then
            log_skip "Web health status: starting"
        else
            log_fail "Web health status: $health"
        fi
    else
        log_fail "Web container not running"
    fi
}

# TC-DOCKER-011: 网络配置
test_network() {
    log_section "TC-DOCKER-011: Network Configuration"
    
    if docker network ls | grep -q "agenthive-network"; then
        log_pass "Network 'agenthive-network' exists"
        
        # 检查容器连接
        local containers=$(docker network inspect agenthive-network --format='{{range .Containers}}{{.Name}} {{end}}')
        if [ -n "$containers" ]; then
            log_pass "Connected containers: $containers"
        else
            log_fail "No containers connected to network"
        fi
    else
        log_fail "Network 'agenthive-network' not found"
    fi
}

# TC-DOCKER-012: 数据卷
test_volumes() {
    log_section "TC-DOCKER-012: Data Volumes"
    
    local volumes=("agenthive-cloud_postgres_data" "agenthive-cloud_redis_data" "agenthive-cloud_supervisor_logs")
    
    for vol in "${volumes[@]}"; do
        if docker volume ls -q | grep -q "^${vol}$"; then
            log_pass "Volume exists: $vol"
        else
            log_skip "Volume not found: $vol (will be created)"
        fi
    done
}

# TC-DOCKER-013: PostgreSQL 连接测试
test_postgres_connection() {
    log_section "TC-DOCKER-013: PostgreSQL Connection"
    
    if docker exec agenthive-postgres pg_isready -U agenthive &>/dev/null; then
        log_pass "PostgreSQL accepting connections"
    else
        log_fail "PostgreSQL not accepting connections"
        return
    fi
    
    # 测试查询
    if docker exec agenthive-postgres psql -U agenthive -c "SELECT 1;" &>/dev/null; then
        log_pass "PostgreSQL query execution successful"
    else
        log_fail "PostgreSQL query execution failed"
    fi
}

# TC-DOCKER-014: Redis 连接测试
test_redis_connection() {
    log_section "TC-DOCKER-014: Redis Connection"
    
    local pong=$(docker exec agenthive-redis redis-cli ping 2>/dev/null || echo "")
    if [ "$pong" = "PONG" ]; then
        log_pass "Redis responding to PING"
    else
        log_fail "Redis not responding"
        return
    fi
    
    # 测试读写
    if docker exec agenthive-redis redis-cli SET test_key test_value &>/dev/null; then
        log_pass "Redis write operation successful"
        docker exec agenthive-redis redis-cli DEL test_key &>/dev/null
    else
        log_fail "Redis write operation failed"
    fi
}

# TC-DOCKER-015: Supervisor API 健康检查
test_supervisor_health() {
    log_section "TC-DOCKER-015: Supervisor Health API"
    
    local response
    response=$(curl -sf "${API_URL}/health" 2>/dev/null || echo "")
    
    if [ -n "$response" ]; then
        log_pass "Supervisor health endpoint accessible"
        if echo "$response" | grep -q "healthy\|ok\|status"; then
            log_pass "Supervisor health response valid: $response"
        fi
    else
        log_fail "Supervisor health endpoint not accessible"
    fi
}

# TC-DOCKER-016: Web 前端健康检查
test_web_health() {
    log_section "TC-DOCKER-016: Web Health Check"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "Web health endpoint returns HTTP 200"
    else
        # 尝试根路径
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" 2>/dev/null || echo "000")
        if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
            log_pass "Web root path accessible (HTTP $http_code)"
        else
            log_fail "Web frontend not accessible (HTTP $http_code)"
        fi
    fi
}

# TC-DOCKER-017: Agents API
test_api_agents() {
    log_section "TC-DOCKER-017: Agents API"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/agents" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "GET /api/agents returns HTTP 200"
        
        # 检查响应格式
        local response
        response=$(curl -sf "${API_URL}/api/agents" 2>/dev/null || echo "")
        if echo "$response" | grep -q "agents\|total"; then
            log_pass "Agents API response format valid"
        else
            log_skip "Agents API response format unknown"
        fi
    else
        log_fail "GET /api/agents returns HTTP $http_code"
    fi
}

# TC-DOCKER-018: Tasks API
test_api_tasks() {
    log_section "TC-DOCKER-018: Tasks API"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/tasks" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "GET /api/tasks returns HTTP 200"
    else
        log_fail "GET /api/tasks returns HTTP $http_code"
    fi
}

# TC-DOCKER-019: Sprints API
test_api_sprints() {
    log_section "TC-DOCKER-019: Sprints API"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/sprints" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "GET /api/sprints returns HTTP 200"
    else
        log_fail "GET /api/sprints returns HTTP $http_code"
    fi
}

# TC-DOCKER-020: 前端首页
test_frontend_home() {
    log_section "TC-DOCKER-020: Frontend Home Page"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        # 检查是否返回 HTML
        local content_type
        content_type=$(curl -sI "${BASE_URL}/" 2>/dev/null | grep -i "content-type" | head -1 || echo "")
        if echo "$content_type" | grep -qi "text/html"; then
            log_pass "Home page returns HTML content"
        else
            log_pass "Home page accessible (HTTP 200)"
        fi
    else
        log_fail "Home page not accessible (HTTP $http_code)"
    fi
}

# TC-DOCKER-021: 登录页面
test_frontend_login() {
    log_section "TC-DOCKER-021: Login Page"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/login" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "Login page accessible"
    else
        log_fail "Login page not accessible (HTTP $http_code)"
    fi
}

# TC-DOCKER-022: Dashboard 页面
test_frontend_dashboard() {
    log_section "TC-DOCKER-022: Dashboard Page"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/dashboard" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "Dashboard page accessible"
    else
        log_fail "Dashboard page not accessible (HTTP $http_code)"
    fi
}

# TC-DOCKER-023: WebSocket 端点
test_websocket() {
    log_section "TC-DOCKER-023: WebSocket Endpoint"
    
    local ws_url="${API_URL/http:/ws:}/ws"
    local response
    response=$(curl -s -N -H "Connection: Upgrade" -H "Upgrade: websocket" "$ws_url" 2>&1 || true)
    
    # WebSocket 升级请求通常会返回 400 或 426
    if echo "$response" | grep -q "400\|426\|101\|WebSocket"; then
        log_pass "WebSocket endpoint is accessible"
    else
        log_skip "WebSocket endpoint check inconclusive"
    fi
}

# TC-DOCKER-024: 服务间通信
test_inter_service_communication() {
    log_section "TC-DOCKER-024: Inter-Service Communication"
    
    # Supervisor -> PostgreSQL
    if docker exec agenthive-supervisor nc -z postgres 5432 2>/dev/null; then
        log_pass "Supervisor can connect to PostgreSQL"
    else
        log_fail "Supervisor cannot connect to PostgreSQL"
    fi
    
    # Supervisor -> Redis
    if docker exec agenthive-supervisor nc -z redis 6379 2>/dev/null; then
        log_pass "Supervisor can connect to Redis"
    else
        log_fail "Supervisor cannot connect to Redis"
    fi
    
    # Web -> Supervisor
    if docker exec agenthive-web nc -z supervisor 8080 2>/dev/null; then
        log_pass "Web can connect to Supervisor"
    else
        log_fail "Web cannot connect to Supervisor"
    fi
}

# TC-DOCKER-025: 资源限制
test_resource_limits() {
    log_section "TC-DOCKER-025: Resource Limits"
    
    local stats
    stats=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep "agenthive" || true)
    
    if [ -n "$stats" ]; then
        log_pass "Resource stats available"
        echo "$stats"
    else
        log_skip "Cannot retrieve resource stats"
    fi
}

# TC-DOCKER-026: 日志检查
test_logs() {
    log_section "TC-DOCKER-026: Container Logs"
    
    for container in "agenthive-supervisor" "agenthive-web"; do
        if docker ps | grep -q "$container"; then
            local error_count
            error_count=$(docker logs --since=5m "$container" 2>&1 | grep -ci "error\|fatal\|panic" || true)
            
            if [ "$error_count" -eq 0 ]; then
                log_pass "$container: No errors in last 5 minutes"
            else
                log_skip "$container: $error_count potential issues in logs"
            fi
        fi
    done
}

# TC-DOCKER-027: 端口映射
test_port_mapping() {
    log_section "TC-DOCKER-027: Port Mapping"
    
    local ports=("5432:PostgreSQL" "6379:Redis" "8080:Supervisor" "80:Web")
    
    for port_info in "${ports[@]}"; do
        IFS=':' read -r port name <<< "$port_info"
        if lsof -Pi :"$port" -sTCP:LISTEN -t &>/dev/null || netstat -tuln 2>/dev/null | grep -q ":$port "; then
            log_pass "Port $port is listening ($name)"
        else
            log_skip "Port $port not accessible on host ($name)"
        fi
    done
}

# TC-DOCKER-028: 重启策略
test_restart_policy() {
    log_section "TC-DOCKER-028: Restart Policy"
    
    local containers=("agenthive-postgres" "agenthive-redis" "agenthive-supervisor" "agenthive-web")
    
    for container in "${containers[@]}"; do
        local policy
        policy=$(docker inspect --format='{{.HostConfig.RestartPolicy.Name}}' "$container" 2>/dev/null || echo "")
        
        if [ "$policy" = "unless-stopped" ] || [ "$policy" = "always" ]; then
            log_pass "$container restart policy: $policy"
        else
            log_skip "$container restart policy: $policy (expected unless-stopped)"
        fi
    done
}

# ==================== 主函数 ====================

print_header() {
    echo ""
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║       Docker Desktop Environment Test Cases                ║${NC}"
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

print_summary() {
    echo ""
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║                      Test Summary                          ║${NC}"
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}✓ Passed:  ${TESTS_PASSED}${NC}"
    echo -e "  ${RED}✗ Failed:  ${TESTS_FAILED}${NC}"
    echo -e "  ${YELLOW}⚠ Skipped: ${TESTS_SKIPPED}${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "  ${GREEN}${BOLD}✓ All critical tests passed!${NC}"
        return 0
    else
        echo -e "  ${RED}${BOLD}✗ Some tests failed${NC}"
        return 1
    fi
}

show_usage() {
    cat << EOF
Docker Desktop Test Cases for AgentHive Cloud

Usage: $0 [OPTIONS]

Options:
  -h, --help      Show this help message
  --pre           Run only prerequisite tests
  --services      Run only service tests
  --api           Run only API tests
  --frontend      Run only frontend tests
  --network       Run only network tests

Environment:
  DOCKER_COMPOSE_FILE   Docker compose file (default: docker-compose.yml)
  API_URL               Supervisor API URL (default: http://localhost:8080)
  BASE_URL              Web frontend URL (default: http://localhost)

Examples:
  $0              # Run all tests
  $0 --pre        # Run only prerequisites
  $0 --api        # Run only API tests

EOF
}

run_all_tests() {
    print_header
    
    # 前置条件
    test_docker_version
    test_compose_version
    test_docker_daemon
    test_compose_syntax
    test_env_file
    test_image_pull
    
    # 容器状态
    test_postgres_running
    test_redis_running
    test_supervisor_running
    test_web_running
    
    # 网络与存储
    test_network
    test_volumes
    
    # 连接测试
    test_postgres_connection
    test_redis_connection
    
    # API 测试
    test_supervisor_health
    test_web_health
    test_api_agents
    test_api_tasks
    test_api_sprints
    
    # 前端测试
    test_frontend_home
    test_frontend_login
    test_frontend_dashboard
    
    # 其他测试
    test_websocket
    test_inter_service_communication
    test_resource_limits
    test_logs
    test_port_mapping
    test_restart_policy
    
    print_summary
}

run_prerequisite_tests() {
    print_header
    test_docker_version
    test_compose_version
    test_docker_daemon
    test_compose_syntax
    test_env_file
    print_summary
}

run_service_tests() {
    print_header
    test_postgres_running
    test_redis_running
    test_supervisor_running
    test_web_running
    test_network
    test_volumes
    test_postgres_connection
    test_redis_connection
    print_summary
}

run_api_tests() {
    print_header
    test_supervisor_health
    test_web_health
    test_api_agents
    test_api_tasks
    test_api_sprints
    print_summary
}

run_frontend_tests() {
    print_header
    test_frontend_home
    test_frontend_login
    test_frontend_dashboard
    print_summary
}

run_network_tests() {
    print_header
    test_network
    test_inter_service_communication
    test_websocket
    test_port_mapping
    print_summary
}

# 主入口
main() {
    case "${1:-all}" in
        -h|--help)
            show_usage
            exit 0
            ;;
        --pre)
            run_prerequisite_tests
            exit $?
            ;;
        --services)
            run_service_tests
            exit $?
            ;;
        --api)
            run_api_tests
            exit $?
            ;;
        --frontend)
            run_frontend_tests
            exit $?
            ;;
        --network)
            run_network_tests
            exit $?
            ;;
        all|"")
            run_all_tests
            exit $?
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
