#!/bin/bash
# ==========================================
# AgentHive Cloud - Local Environment Test Suite
# ==========================================
# 一键运行测试脚本，支持 Docker Desktop 和 K8s 本地环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# 测试计数器
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# 配置
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.yml}"
K8S_NAMESPACE="${K8S_NAMESPACE:-agenthive}"
TEST_TIMEOUT="${TEST_TIMEOUT:-30}"
VERBOSE="${VERBOSE:-false}"

# 服务端点
SUPERVISOR_URL="${SUPERVISOR_URL:-http://localhost:8080}"
WEB_URL="${WEB_URL:-http://localhost:80}"

# ==================== 工具函数 ====================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((TESTS_SKIPPED++))
}

log_section() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_header() {
    echo ""
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║        AgentHive Cloud - Local Environment Tests           ║${NC}"
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Environment: ${CYAN}${TEST_MODE}${NC}"
    echo -e "Timestamp:   $(date '+%Y-%m-%d %H:%M:%S')"
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
    
    TOTAL=$((TESTS_PASSED + TESTS_FAILED))
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "  ${GREEN}${BOLD}✓ All tests passed!${NC}"
        return 0
    else
        echo -e "  ${RED}${BOLD}✗ Some tests failed${NC}"
        echo ""
        echo -e "  Run with ${YELLOW}VERBOSE=true${NC} for detailed output"
        return 1
    fi
}

# 检查命令是否存在
check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# 等待服务就绪
wait_for_service() {
    local url=$1
    local timeout=${2:-30}
    local start_time=$(date +%s)
    
    while true; do
        if curl -sf "$url" &>/dev/null; then
            return 0
        fi
        
        local current_time=$(date +%s)
        if [ $((current_time - start_time)) -ge $timeout ]; then
            return 1
        fi
        
        sleep 1
    done
}

# ==================== 前置检查 ====================

check_prerequisites() {
    log_section "Prerequisites Check"
    
    # Docker
    if check_command docker; then
        local version=$(docker --version | awk '{print $3}' | tr -d ',')
        log_success "Docker installed ($version)"
    else
        log_error "Docker not installed"
        return 1
    fi
    
    # Docker 运行状态
    if docker info &>/dev/null; then
        log_success "Docker daemon is running"
    else
        log_error "Docker daemon is not running"
        return 1
    fi
    
    # Docker Compose
    if check_command docker-compose; then
        local version=$(docker-compose --version | awk '{print $3}' | tr -d ',')
        log_success "Docker Compose installed ($version)"
    elif docker compose version &>/dev/null; then
        local version=$(docker compose version | awk '{print $4}')
        log_success "Docker Compose (plugin) installed ($version)"
    else
        log_error "Docker Compose not installed"
        return 1
    fi
    
    # Kubectl (如果测试 K8s)
    if [ "$TEST_MODE" = "k8s" ]; then
        if check_command kubectl; then
            local version=$(kubectl version --client -o json | grep -o '"gitVersion":"[^"]*"' | head -1 | cut -d'"' -f4)
            log_success "kubectl installed ($version)"
        else
            log_error "kubectl not installed"
            return 1
        fi
    fi
    
    # Curl
    if check_command curl; then
        log_success "curl installed"
    else
        log_error "curl not installed"
        return 1
    fi
}

# ==================== Docker Desktop 测试 ====================

test_docker_prerequisites() {
    log_section "Docker Prerequisites"
    
    # 检查 .env 文件
    if [ -f .env ]; then
        log_success ".env file exists"
    else
        log_warn ".env file missing (optional, using defaults)"
    fi
    
    # 检查 compose 文件
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        log_success "docker-compose.yml exists"
    else
        log_error "docker-compose.yml not found"
    fi
}

test_docker_compose_validation() {
    log_section "Docker Compose Validation"
    
    # 验证 compose 文件语法
    if docker-compose -f "$DOCKER_COMPOSE_FILE" config > /dev/null 2>&1; then
        log_success "docker-compose.yml syntax is valid"
    else
        log_error "docker-compose.yml has syntax errors"
    fi
    
    # 检查镜像可拉取
    log_info "Checking if required images can be pulled..."
    local images=$(docker-compose -f "$DOCKER_COMPOSE_FILE" config | grep "image:" | awk '{print $2}' | sort -u)
    for image in $images; do
        # 跳过本地构建的镜像
        if [[ "$image" == agenthive/* ]]; then
            continue
        fi
        if docker pull "$image" > /dev/null 2>&1; then
            log_success "Image available: $image"
        else
            log_warn "Cannot pull image: $image"
        fi
    done
}

test_docker_services_running() {
    log_section "Docker Services Status"
    
    local services=("postgres" "redis" "supervisor" "web")
    
    for service in "${services[@]}"; do
        local container_name="agenthive-${service}"
        if docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
            log_success "Container running: $container_name"
            
            # 检查健康状态
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
            if [ "$health" = "healthy" ]; then
                log_success "Container healthy: $container_name"
            elif [ "$health" = "starting" ]; then
                log_warn "Container still starting: $container_name"
            elif [ "$health" != "unknown" ]; then
                log_error "Container not healthy: $container_name (status: $health)"
            fi
        else
            log_error "Container not running: $container_name"
        fi
    done
}

test_docker_network() {
    log_section "Docker Network"
    
    if docker network ls | grep -q "agenthive-network"; then
        log_success "Network 'agenthive-network' exists"
        
        # 检查容器是否连接到网络
        local connected=$(docker network inspect agenthive-network --format='{{range .Containers}}{{.Name}} {{end}}')
        if [ -n "$connected" ]; then
            log_success "Connected containers: $connected"
        else
            log_warn "No containers connected to network"
        fi
    else
        log_error "Network 'agenthive-network' not found"
    fi
}

test_docker_volumes() {
    log_section "Docker Volumes"
    
    local volumes=("postgres_data" "redis_data" "supervisor_logs")
    
    for volume in "${volumes[@]}"; do
        local full_name="agenthive-cloud_${volume}"
        if docker volume ls | grep -q "$full_name"; then
            log_success "Volume exists: $volume"
        else
            log_warn "Volume not found: $volume (will be created on start)"
        fi
    done
}

# ==================== K8s 测试 ====================

test_k8s_prerequisites() {
    log_section "K8s Prerequisites"
    
    # 检查 kubectl 连接
    if kubectl cluster-info &>/dev/null; then
        log_success "Connected to Kubernetes cluster"
        local version=$(kubectl version -o json 2>/dev/null | grep -o '"serverVersion":{"major":"[^"]*","minor":"[^"]*"' | sed 's/.*"major":"\([^"]*\)","minor":"\([^"]*\)".*/v\1.\2/')
        log_info "Server version: $version"
    else
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    # 检查 Kustomize
    if kubectl kustomize --help &>/dev/null; then
        log_success "Kustomize available"
    else
        log_warn "Kustomize not available via kubectl"
    fi
}

test_k8s_namespace() {
    log_section "K8s Namespace"
    
    if kubectl get namespace "$K8S_NAMESPACE" &>/dev/null; then
        log_success "Namespace exists: $K8S_NAMESPACE"
    else
        log_error "Namespace not found: $K8S_NAMESPACE"
    fi
}

test_k8s_deployments() {
    log_section "K8s Deployments"
    
    local deployments=("supervisor" "web")
    
    for deploy in "${deployments[@]}"; do
        if kubectl get deployment "$deploy" -n "$K8S_NAMESPACE" &>/dev/null; then
            # 检查副本数
            local ready=$(kubectl get deployment "$deploy" -n "$K8S_NAMESPACE" -o jsonpath='{.status.readyReplicas}')
            local desired=$(kubectl get deployment "$deploy" -n "$K8S_NAMESPACE" -o jsonpath='{.spec.replicas}')
            
            if [ "$ready" = "$desired" ]; then
                log_success "Deployment ready: $deploy ($ready/$desired)"
            else
                log_error "Deployment not ready: $deploy ($ready/$desired)"
            fi
        else
            log_error "Deployment not found: $deploy"
        fi
    done
}

test_k8s_services() {
    log_section "K8s Services"
    
    local services=("supervisor" "web" "postgres" "redis")
    
    for svc in "${services[@]}"; do
        if kubectl get service "$svc" -n "$K8S_NAMESPACE" &>/dev/null; then
            local type=$(kubectl get service "$svc" -n "$K8S_NAMESPACE" -o jsonpath='{.spec.type}')
            local cluster_ip=$(kubectl get service "$svc" -n "$K8S_NAMESPACE" -o jsonpath='{.spec.clusterIP}')
            log_success "Service exists: $svc (Type: $type, IP: $cluster_ip)"
        else
            log_error "Service not found: $svc"
        fi
    done
}

test_k8s_pods() {
    log_section "K8s Pods"
    
    local pods=$(kubectl get pods -n "$K8S_NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
    
    if [ -z "$pods" ]; then
        log_error "No pods found in namespace $K8S_NAMESPACE"
        return
    fi
    
    for pod in $pods; do
        local status=$(kubectl get pod "$pod" -n "$K8S_NAMESPACE" -o jsonpath='{.status.phase}')
        local ready=$(kubectl get pod "$pod" -n "$K8S_NAMESPACE" -o jsonpath='{.status.containerStatuses[0].ready}')
        
        if [ "$status" = "Running" ] && [ "$ready" = "true" ]; then
            log_success "Pod running: $pod"
        elif [ "$status" = "Running" ]; then
            log_warn "Pod running but not ready: $pod"
        else
            log_error "Pod not running: $pod (status: $status)"
        fi
    done
}

test_k8s_ingress() {
    log_section "K8s Ingress"
    
    if kubectl get ingress -n "$K8S_NAMESPACE" &>/dev/null; then
        local ingresses=$(kubectl get ingress -n "$K8S_NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
        for ing in $ingresses; do
            log_success "Ingress exists: $ing"
        done
        
        # 检查 Ingress Controller
        if kubectl get pods --all-namespaces -l app.kubernetes.io/name=ingress-nginx 2>/dev/null | grep -q "Running"; then
            log_success "NGINX Ingress Controller is running"
        else
            log_warn "NGINX Ingress Controller may not be running"
        fi
    else
        log_warn "No ingress found in namespace $K8S_NAMESPACE"
    fi
}

test_k8s_configmaps() {
    log_section "K8s ConfigMaps & Secrets"
    
    # ConfigMaps
    if kubectl get configmap agenthive-config -n "$K8S_NAMESPACE" &>/dev/null; then
        log_success "ConfigMap exists: agenthive-config"
    else
        log_error "ConfigMap not found: agenthive-config"
    fi
    
    if kubectl get configmap agenthive-nginx-config -n "$K8S_NAMESPACE" &>/dev/null; then
        log_success "ConfigMap exists: agenthive-nginx-config"
    else
        log_warn "ConfigMap not found: agenthive-nginx-config"
    fi
    
    # Secrets
    if kubectl get secret agenthive-secrets -n "$K8S_NAMESPACE" &>/dev/null; then
        log_success "Secret exists: agenthive-secrets"
    else
        log_error "Secret not found: agenthive-secrets"
    fi
}

test_k8s_hpa() {
    log_section "K8s Horizontal Pod Autoscaler"
    
    local hpas=("supervisor-hpa" "web-hpa")
    
    for hpa in "${hpas[@]}"; do
        if kubectl get hpa "$hpa" -n "$K8S_NAMESPACE" &>/dev/null; then
            local current=$(kubectl get hpa "$hpa" -n "$K8S_NAMESPACE" -o jsonpath='{.status.currentReplicas}')
            local min=$(kubectl get hpa "$hpa" -n "$K8S_NAMESPACE" -o jsonpath='{.spec.minReplicas}')
            local max=$(kubectl get hpa "$hpa" -n "$K8S_NAMESPACE" -o jsonpath='{.spec.maxReplicas}')
            log_success "HPA exists: $hpa (current: $current, min: $min, max: $max)"
        else
            log_warn "HPA not found: $hpa"
        fi
    done
}

# ==================== 服务健康检查 ====================

test_health_checks() {
    log_section "Service Health Checks"
    
    # Supervisor Health
    log_info "Checking Supervisor health endpoint..."
    if curl -sf "${SUPERVISOR_URL}/health" &>/dev/null; then
        local response=$(curl -s "${SUPERVISOR_URL}/health")
        log_success "Supervisor health check passed: $response"
    else
        log_error "Supervisor health check failed (${SUPERVISOR_URL}/health)"
    fi
    
    # Web Health
    log_info "Checking Web frontend health endpoint..."
    if curl -sf "${WEB_URL}/health" -o /dev/null; then
        log_success "Web frontend health check passed"
    else
        # 尝试根路径
        if curl -sf "${WEB_URL}" -o /dev/null; then
            log_success "Web frontend responding (root path)"
        else
            log_error "Web frontend not responding"
        fi
    fi
}

# ==================== API 连通性测试 ====================

test_api_connectivity() {
    log_section "API Connectivity Tests"
    
    local endpoints=(
        "GET:/health:Health"
        "GET:/api/agents:List Agents"
        "GET:/api/tasks:List Tasks"
        "GET:/api/sprints:List Sprints"
    )
    
    for endpoint in "${endpoints[@]}"; do
        IFS=':' read -r method path name <<< "$endpoint"
        local url="${SUPERVISOR_URL}${path}"
        
        log_info "Testing $name ($method $path)..."
        
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        
        case "$http_code" in
            200|201)
                log_success "$name - HTTP $http_code"
                ;;
            401|403)
                log_success "$name - HTTP $http_code (Auth required, endpoint exists)"
                ;;
            000)
                log_error "$name - Connection failed"
                ;;
            *)
                log_error "$name - HTTP $http_code"
                ;;
        esac
    done
}

# ==================== 前端页面加载测试 ====================

test_frontend_pages() {
    log_section "Frontend Page Load Tests"
    
    local pages=(
        "/:Home Page"
        "/login:Login Page"
        "/dashboard:Dashboard"
    )
    
    for page in "${pages[@]}"; do
        IFS=':' read -r path name <<< "$page"
        local url="${WEB_URL}${path}"
        
        log_info "Testing $name ($path)..."
        
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        
        if [ "$http_code" = "200" ]; then
            # 检查是否返回了 HTML
            local content_type
            content_type=$(curl -sI "$url" 2>/dev/null | grep -i "content-type" | head -1 || echo "")
            if echo "$content_type" | grep -qi "text/html"; then
                log_success "$name - Loaded successfully"
            else
                log_success "$name - HTTP 200 (content type: $content_type)"
            fi
        elif [ "$http_code" = "000" ]; then
            log_error "$name - Connection failed"
        else
            log_error "$name - HTTP $http_code"
        fi
    done
}

# ==================== WebSocket 测试 ====================

test_websocket() {
    log_section "WebSocket Tests"
    
    local ws_url="${SUPERVISOR_URL/http:/ws:}/ws"
    
    log_info "Checking WebSocket endpoint..."
    
    # 使用 curl 检查 WebSocket 端点是否可访问
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -N -H "Connection: Upgrade" -H "Upgrade: websocket" "$ws_url" 2>/dev/null || echo "000")
    
    # WebSocket 升级通常会返回 400 或 426，表示端点存在
    if [ "$http_code" = "400" ] || [ "$http_code" = "426" ] || [ "$http_code" = "101" ]; then
        log_success "WebSocket endpoint available"
    elif [ "$http_code" = "000" ]; then
        log_error "WebSocket endpoint unreachable"
    else
        log_warn "WebSocket endpoint returned HTTP $http_code"
    fi
}

# ==================== 数据库连通性测试 ====================

test_database_connectivity() {
    log_section "Database Connectivity"
    
    if [ "$TEST_MODE" = "docker" ]; then
        if docker ps | grep -q "agenthive-postgres"; then
            if docker exec agenthive-postgres pg_isready -U agenthive &>/dev/null; then
                log_success "PostgreSQL is accepting connections"
            else
                log_error "PostgreSQL is not accepting connections"
            fi
        else
            log_warn "PostgreSQL container not running"
        fi
        
        if docker ps | grep -q "agenthive-redis"; then
            if docker exec agenthive-redis redis-cli ping | grep -q "PONG"; then
                log_success "Redis is responding"
            else
                log_error "Redis is not responding"
            fi
        else
            log_warn "Redis container not running"
        fi
    elif [ "$TEST_MODE" = "k8s" ]; then
        # K8s 环境下通过端口转发或直接检查
        if kubectl get pods -n "$K8S_NAMESPACE" | grep -q "postgres.*Running"; then
            log_success "PostgreSQL pod is running"
        else
            log_warn "PostgreSQL pod not found or not running"
        fi
        
        if kubectl get pods -n "$K8S_NAMESPACE" | grep -q "redis.*Running"; then
            log_success "Redis pod is running"
        else
            log_warn "Redis pod not found or not running"
        fi
    fi
}

# ==================== 性能测试 ====================

test_performance() {
    log_section "Performance Tests"
    
    log_info "Testing API response time..."
    
    local total_time=0
    local count=3
    
    for i in $(seq 1 $count); do
        local time_taken
        time_taken=$(curl -s -o /dev/null -w "%{time_total}" "${SUPERVISOR_URL}/health" 2>/dev/null || echo "0")
        total_time=$(echo "$total_time + $time_taken" | bc 2>/dev/null || echo "0")
        sleep 0.5
    done
    
    if [ "$total_time" != "0" ]; then
        local avg_time
        avg_time=$(echo "scale=3; $total_time / $count" | bc 2>/dev/null || echo "N/A")
        if [ "$avg_time" != "N/A" ] && (( $(echo "$avg_time < 1.0" | bc -l 2>/dev/null || echo "0") )); then
            log_success "API average response time: ${avg_time}s"
        else
            log_warn "API average response time: ${avg_time}s (may be slow)"
        fi
    else
        log_warn "Could not measure response time"
    fi
}

# ==================== 日志检查 ====================

check_logs() {
    log_section "Recent Logs Check"
    
    if [ "$TEST_MODE" = "docker" ]; then
        for container in "supervisor" "web"; do
            local container_name="agenthive-${container}"
            if docker ps | grep -q "$container_name"; then
                local error_count
                error_count=$(docker logs --since=5m "$container_name" 2>&1 | grep -ci "error" || true)
                if [ "$error_count" -eq 0 ]; then
                    log_success "$container: No errors in last 5 minutes"
                else
                    log_warn "$container: $error_count error(s) in last 5 minutes"
                fi
            fi
        done
    elif [ "$TEST_MODE" = "k8s" ]; then
        for pod in supervisor web; do
            local pod_name
            pod_name=$(kubectl get pods -n "$K8S_NAMESPACE" -l "app=agenthive-${pod}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
            if [ -n "$pod_name" ]; then
                local error_count
                error_count=$(kubectl logs -n "$K8S_NAMESPACE" "$pod_name" --since=5m 2>&1 | grep -ci "error" || true)
                if [ "$error_count" -eq 0 ]; then
                    log_success "$pod: No errors in last 5 minutes"
                else
                    log_warn "$pod: $error_count error(s) in last 5 minutes"
                fi
            fi
        done
    fi
}

# ==================== 主函数 ====================

show_usage() {
    cat << EOF
AgentHive Cloud Local Environment Test Suite

Usage: $0 [OPTIONS] [MODE]

Modes:
  docker    Test Docker Desktop environment
  k8s       Test Kubernetes local environment
  all       Run all tests (default)

Options:
  -h, --help          Show this help message
  -v, --verbose       Enable verbose output
  -t, --timeout SEC   Set timeout for service checks (default: 30)

Environment Variables:
  TEST_MODE           Test mode (docker|k8s|all)
  DOCKER_COMPOSE_FILE Path to docker-compose file (default: docker-compose.yml)
  K8S_NAMESPACE       Kubernetes namespace (default: agenthive)
  SUPERVISOR_URL      Supervisor API URL (default: http://localhost:8080)
  WEB_URL             Web frontend URL (default: http://localhost:80)
  VERBOSE             Enable verbose output (true|false)

Examples:
  $0 docker                    # Test Docker environment
  $0 k8s                       # Test K8s environment
  TEST_MODE=docker $0          # Same as above
  $0 docker -v                 # Verbose mode
  SUPERVISOR_URL=http://api:8080 $0 k8s

EOF
}

run_docker_tests() {
    TEST_MODE="docker"
    print_header
    
    check_prerequisites
    test_docker_prerequisites
    test_docker_compose_validation
    test_docker_network
    test_docker_volumes
    test_docker_services_running
    test_health_checks
    test_api_connectivity
    test_frontend_pages
    test_websocket
    test_database_connectivity
    test_performance
    check_logs
    
    print_summary
}

run_k8s_tests() {
    TEST_MODE="k8s"
    print_header
    
    check_prerequisites
    test_k8s_prerequisites
    test_k8s_namespace
    test_k8s_configmaps
    test_k8s_deployments
    test_k8s_services
    test_k8s_pods
    test_k8s_ingress
    test_k8s_hpa
    test_health_checks
    test_api_connectivity
    test_frontend_pages
    test_websocket
    test_database_connectivity
    test_performance
    check_logs
    
    print_summary
}

# ==================== 入口 ====================

main() {
    # 解析参数
    local mode="${TEST_MODE:-all}"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -t|--timeout)
                TEST_TIMEOUT="$2"
                shift 2
                ;;
            docker|k8s|all)
                mode="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    case "$mode" in
        docker)
            run_docker_tests
            exit $?
            ;;
        k8s)
            run_k8s_tests
            exit $?
            ;;
        all)
            # 先检测环境并运行相应测试
            if docker ps &>/dev/null && docker-compose ps 2>/dev/null | grep -q "agenthive"; then
                run_docker_tests
            elif kubectl get namespace "$K8S_NAMESPACE" &>/dev/null; then
                run_k8s_tests
            else
                echo -e "${YELLOW}No active environment detected.${NC}"
                echo "Please start Docker Compose or deploy to K8s first."
                exit 1
            fi
            exit $?
            ;;
        *)
            echo "Unknown mode: $mode"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
