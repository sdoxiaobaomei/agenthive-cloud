#!/bin/bash
# ==========================================
# AgentHive Cloud - Kubernetes Local Test Cases
# ==========================================
# K8s 本地环境详细测试用例

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
NAMESPACE="${K8S_NAMESPACE:-agenthive}"
INGRESS_HOST="${INGRESS_HOST:-agenthive.local}"
API_URL="${API_URL:-http://localhost:8080}"
BASE_URL="${BASE_URL:-http://localhost:8080}"

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

# TC-K8S-001: kubectl 版本检查
test_kubectl_version() {
    log_section "TC-K8S-001: kubectl Version Check"
    
    if command -v kubectl &>/dev/null; then
        local version
        version=$(kubectl version --client -o json 2>/dev/null | grep -o '"gitVersion":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_pass "kubectl installed ($version)"
    else
        log_fail "kubectl not installed"
    fi
}

# TC-K8S-002: 集群连接检查
test_cluster_connection() {
    log_section "TC-K8S-002: Cluster Connection"
    
    if kubectl cluster-info &>/dev/null; then
        local version
        version=$(kubectl version -o json 2>/dev/null | grep -o '"serverVersion":{"major":"[^"]*","minor":"[^"]*"' | sed 's/.*"major":"\([^"]*\)","minor":"\([^"]*\)".*/v\1.\2/')
        log_pass "Connected to K8s cluster ($version)"
    else
        log_fail "Cannot connect to K8s cluster"
        return 1
    fi
}

# TC-K8S-003: Kustomize 检查
test_kustomize() {
    log_section "TC-K8S-003: Kustomize Check"
    
    if kubectl kustomize --help &>/dev/null; then
        log_pass "Kustomize available via kubectl"
    else
        log_skip "Kustomize not available (may need standalone installation)"
    fi
}

# TC-K8S-004: 命名空间检查
test_namespace() {
    log_section "TC-K8S-004: Namespace Check"
    
    if kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log_pass "Namespace '$NAMESPACE' exists"
        
        # 检查标签
        local labels
        labels=$(kubectl get namespace "$NAMESPACE" -o jsonpath='{.metadata.labels}' 2>/dev/null || echo "")
        if echo "$labels" | grep -q "app.kubernetes.io/part-of"; then
            log_pass "Namespace has correct labels"
        fi
    else
        log_fail "Namespace '$NAMESPACE' not found"
    fi
}

# TC-K8S-005: ConfigMap 检查
test_configmaps() {
    log_section "TC-K8S-005: ConfigMaps"
    
    local configmaps=("agenthive-config" "agenthive-nginx-config")
    
    for cm in "${configmaps[@]}"; do
        if kubectl get configmap "$cm" -n "$NAMESPACE" &>/dev/null; then
            log_pass "ConfigMap exists: $cm"
        else
            log_fail "ConfigMap not found: $cm"
        fi
    done
}

# TC-K8S-006: Secret 检查
test_secrets() {
    log_section "TC-K8S-006: Secrets"
    
    if kubectl get secret agenthive-secrets -n "$NAMESPACE" &>/dev/null; then
        log_pass "Secret exists: agenthive-secrets"
        
        # 检查必需键
        local keys
        keys=$(kubectl get secret agenthive-secrets -n "$NAMESPACE" -o jsonpath='{.data}' 2>/dev/null || echo "")
        if [ -n "$keys" ]; then
            log_pass "Secret has data keys"
        fi
    else
        log_fail "Secret not found: agenthive-secrets"
    fi
}

# TC-K8S-007: PostgreSQL Deployment
test_postgres_deployment() {
    log_section "TC-K8S-007: PostgreSQL Deployment"
    
    if kubectl get deployment postgres -n "$NAMESPACE" &>/dev/null; then
        log_pass "PostgreSQL Deployment exists"
        
        # 检查副本
        local ready desired
        ready=$(kubectl get deployment postgres -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        desired=$(kubectl get deployment postgres -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$ready" = "$desired" ] && [ "$ready" != "0" ]; then
            log_pass "PostgreSQL pods ready: $ready/$desired"
        else
            log_fail "PostgreSQL pods not ready: $ready/$desired"
        fi
    else
        log_fail "PostgreSQL Deployment not found"
    fi
}

# TC-K8S-008: PostgreSQL Service
test_postgres_service() {
    log_section "TC-K8S-008: PostgreSQL Service"
    
    if kubectl get service postgres -n "$NAMESPACE" &>/dev/null; then
        log_pass "PostgreSQL Service exists"
        
        local cluster_ip
        cluster_ip=$(kubectl get service postgres -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
        log_pass "PostgreSQL ClusterIP: $cluster_ip"
    else
        log_fail "PostgreSQL Service not found"
    fi
}

# TC-K8S-009: Redis Deployment
test_redis_deployment() {
    log_section "TC-K8S-009: Redis Deployment"
    
    if kubectl get deployment redis -n "$NAMESPACE" &>/dev/null; then
        log_pass "Redis Deployment exists"
        
        local ready desired
        ready=$(kubectl get deployment redis -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        desired=$(kubectl get deployment redis -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$ready" = "$desired" ] && [ "$ready" != "0" ]; then
            log_pass "Redis pods ready: $ready/$desired"
        else
            log_fail "Redis pods not ready: $ready/$desired"
        fi
    else
        log_fail "Redis Deployment not found"
    fi
}

# TC-K8S-010: Redis Service
test_redis_service() {
    log_section "TC-K8S-010: Redis Service"
    
    if kubectl get service redis -n "$NAMESPACE" &>/dev/null; then
        log_pass "Redis Service exists"
        
        local cluster_ip
        cluster_ip=$(kubectl get service redis -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
        log_pass "Redis ClusterIP: $cluster_ip"
    else
        log_fail "Redis Service not found"
    fi
}

# TC-K8S-011: Supervisor Deployment
test_supervisor_deployment() {
    log_section "TC-K8S-011: Supervisor Deployment"
    
    if kubectl get deployment supervisor -n "$NAMESPACE" &>/dev/null; then
        log_pass "Supervisor Deployment exists"
        
        local ready desired
        ready=$(kubectl get deployment supervisor -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        desired=$(kubectl get deployment supervisor -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$ready" = "$desired" ] && [ "$ready" != "0" ]; then
            log_pass "Supervisor pods ready: $ready/$desired"
        else
            log_fail "Supervisor pods not ready: $ready/$desired"
        fi
    else
        log_fail "Supervisor Deployment not found"
    fi
}

# TC-K8S-012: Supervisor Service
test_supervisor_service() {
    log_section "TC-K8S-012: Supervisor Service"
    
    if kubectl get service supervisor -n "$NAMESPACE" &>/dev/null; then
        log_pass "Supervisor Service exists"
        
        local cluster_ip type
        cluster_ip=$(kubectl get service supervisor -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
        type=$(kubectl get service supervisor -n "$NAMESPACE" -o jsonpath='{.spec.type}')
        log_pass "Supervisor Service: $type, ClusterIP: $cluster_ip"
    else
        log_fail "Supervisor Service not found"
    fi
}

# TC-K8S-013: Web Deployment
test_web_deployment() {
    log_section "TC-K8S-013: Web Deployment"
    
    if kubectl get deployment web -n "$NAMESPACE" &>/dev/null; then
        log_pass "Web Deployment exists"
        
        local ready desired
        ready=$(kubectl get deployment web -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        desired=$(kubectl get deployment web -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$ready" = "$desired" ] && [ "$ready" != "0" ]; then
            log_pass "Web pods ready: $ready/$desired"
        else
            log_fail "Web pods not ready: $ready/$desired"
        fi
    else
        log_fail "Web Deployment not found"
    fi
}

# TC-K8S-014: Web Service
test_web_service() {
    log_section "TC-K8S-014: Web Service"
    
    if kubectl get service web -n "$NAMESPACE" &>/dev/null; then
        log_pass "Web Service exists"
        
        local cluster_ip type
        cluster_ip=$(kubectl get service web -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
        type=$(kubectl get service web -n "$NAMESPACE" -o jsonpath='{.spec.type}')
        log_pass "Web Service: $type, ClusterIP: $cluster_ip"
    else
        log_fail "Web Service not found"
    fi
}

# TC-K8S-015: Pod 状态检查
test_pod_status() {
    log_section "TC-K8S-015: Pod Status"
    
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
    
    if [ -z "$pods" ]; then
        log_fail "No pods found in namespace $NAMESPACE"
        return
    fi
    
    for pod in $pods; do
        local status phase ready
        status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0]}' 2>/dev/null || echo "")
        phase=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
        ready=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || echo "false")
        
        if [ "$phase" = "Running" ] && [ "$ready" = "true" ]; then
            log_pass "Pod ready: $pod"
        elif [ "$phase" = "Running" ]; then
            log_skip "Pod running but not ready: $pod"
        elif [ "$phase" = "Pending" ]; then
            log_skip "Pod pending: $pod"
        else
            log_fail "Pod issue: $pod (phase: $phase)"
        fi
    done
}

# TC-K8S-016: Ingress 配置
test_ingress() {
    log_section "TC-K8S-016: Ingress Configuration"
    
    if kubectl get ingress -n "$NAMESPACE" &>/dev/null; then
        local ingresses
        ingresses=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
        for ing in $ingresses; do
            log_pass "Ingress exists: $ing"
        done
    else
        log_skip "No ingress found"
    fi
}

# TC-K8S-017: Ingress Controller
test_ingress_controller() {
    log_section "TC-K8S-017: Ingress Controller"
    
    # 查找常见的 Ingress Controller 命名空间
    local controller_ns=("ingress-nginx" "kube-system" "ingress-controller")
    local found=false
    
    for ns in "${controller_ns[@]}"; do
        if kubectl get pods -n "$ns" -l "app.kubernetes.io/name=ingress-nginx" 2>/dev/null | grep -q "Running"; then
            log_pass "NGINX Ingress Controller found in namespace: $ns"
            found=true
            break
        fi
    done
    
    if [ "$found" = false ]; then
        # 尝试其他标签
        if kubectl get pods --all-namespaces 2>/dev/null | grep -i "ingress" | grep -q "Running"; then
            log_pass "Ingress Controller found (different label)"
        else
            log_skip "Ingress Controller not detected"
        fi
    fi
}

# TC-K8S-018: HPA 配置
test_hpa() {
    log_section "TC-K8S-018: Horizontal Pod Autoscaler"
    
    local hpas=("supervisor-hpa" "web-hpa")
    
    for hpa in "${hpas[@]}"; do
        if kubectl get hpa "$hpa" -n "$NAMESPACE" &>/dev/null; then
            local current min max
            current=$(kubectl get hpa "$hpa" -n "$NAMESPACE" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo "?")
            min=$(kubectl get hpa "$hpa" -n "$NAMESPACE" -o jsonpath='{.spec.minReplicas}')
            max=$(kubectl get hpa "$hpa" -n "$NAMESPACE" -o jsonpath='{.spec.maxReplicas}')
            log_pass "HPA: $hpa (current: $current, min: $min, max: $max)"
        else
            log_skip "HPA not found: $hpa"
        fi
    done
}

# TC-K8S-019: Endpoints 检查
test_endpoints() {
    log_section "TC-K8S-019: Service Endpoints"
    
    local services=("supervisor" "web" "postgres" "redis")
    
    for svc in "${services[@]}"; do
        local endpoints
        endpoints=$(kubectl get endpoints "$svc" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
        
        if [ -n "$endpoints" ]; then
            log_pass "Service $svc has endpoints: $endpoints"
        else
            log_fail "Service $svc has no endpoints"
        fi
    done
}

# TC-K8S-020: 健康检查配置
test_health_checks() {
    log_section "TC-K8S-020: Health Check Configuration"
    
    # Supervisor 探针
    local liveness readiness
    liveness=$(kubectl get deployment supervisor -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].livenessProbe.httpGet.path}' 2>/dev/null || echo "")
    readiness=$(kubectl get deployment supervisor -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}' 2>/dev/null || echo "")
    
    if [ "$liveness" = "/health" ]; then
        log_pass "Supervisor has liveness probe configured"
    else
        log_skip "Supervisor liveness probe: $liveness"
    fi
    
    if [ "$readiness" = "/health" ]; then
        log_pass "Supervisor has readiness probe configured"
    else
        log_skip "Supervisor readiness probe: $readiness"
    fi
}

# TC-K8S-021: 资源限制
test_resource_limits() {
    log_section "TC-K8S-021: Resource Limits"
    
    local deployments=("supervisor" "web")
    
    for deploy in "${deployments[@]}"; do
        local limits_requests
        limits_requests=$(kubectl get deployment "$deploy" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources}' 2>/dev/null || echo "")
        
        if [ -n "$limits_requests" ]; then
            log_pass "$deploy has resource limits configured"
        else
            log_skip "$deploy has no resource limits"
        fi
    done
}

# TC-K8S-022: API 健康检查
test_api_health() {
    log_section "TC-K8S-022: API Health Check"
    
    local response
    response=$(curl -sf "${API_URL}/health" 2>/dev/null || echo "")
    
    if [ -n "$response" ]; then
        log_pass "API health endpoint accessible"
        if echo "$response" | grep -q "healthy\|ok\|status"; then
            log_pass "API health response: $response"
        fi
    else
        log_fail "API health endpoint not accessible"
    fi
}

# TC-K8S-023: API Agents 端点
test_api_agents() {
    log_section "TC-K8S-023: API Agents Endpoint"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/agents" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "GET /api/agents returns HTTP 200"
    else
        log_fail "GET /api/agents returns HTTP $http_code"
    fi
}

# TC-K8S-024: API Tasks 端点
test_api_tasks() {
    log_section "TC-K8S-024: API Tasks Endpoint"
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/tasks" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_pass "GET /api/tasks returns HTTP 200"
    else
        log_fail "GET /api/tasks returns HTTP $http_code"
    fi
}

# TC-K8S-025: 前端页面
test_frontend() {
    log_section "TC-K8S-025: Frontend Pages"
    
    local pages=("/" "/login" "/dashboard")
    
    for page in "${pages[@]}"; do
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${page}" 2>/dev/null || echo "000")
        
        if [ "$http_code" = "200" ]; then
            log_pass "Page $page accessible"
        else
            log_fail "Page $page not accessible (HTTP $http_code)"
        fi
    done
}

# TC-K8S-026: 事件检查
test_events() {
    log_section "TC-K8S-026: Recent Events"
    
    local warnings_errors
    warnings_errors=$(kubectl get events -n "$NAMESPACE" --field-selector type!=Normal 2>/dev/null | tail -5 || echo "")
    
    if [ -z "$warnings_errors" ] || [ "$(echo "$warnings_errors" | wc -l)" -le 1 ]; then
        log_pass "No recent warnings or errors"
    else
        log_skip "Recent events found (check with: kubectl get events -n $NAMESPACE)"
    fi
}

# TC-K8S-027: 日志检查
test_logs() {
    log_section "TC-K8S-027: Pod Logs"
    
    local deployments=("supervisor" "web")
    
    for deploy in "${deployments[@]}"; do
        local pod
        pod=$(kubectl get pods -n "$NAMESPACE" -l "app=agenthive-${deploy}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        
        if [ -n "$pod" ]; then
            local error_count
            error_count=$(kubectl logs -n "$NAMESPACE" "$pod" --since=5m 2>&1 | grep -ci "error\|fatal\|panic" || true)
            
            if [ "$error_count" -eq 0 ]; then
                log_pass "$deploy: No errors in recent logs"
            else
                log_skip "$deploy: $error_count potential issues in logs"
            fi
        fi
    done
}

# ==================== 主函数 ====================

print_header() {
    echo ""
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║        Kubernetes Local Environment Test Cases             ║${NC}"
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Namespace: ${CYAN}${NAMESPACE}${NC}"
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
Kubernetes Local Test Cases for AgentHive Cloud

Usage: $0 [OPTIONS]

Options:
  -h, --help      Show this help message
  --pre           Run only prerequisite tests
  --resources     Run only resource tests
  --api           Run only API tests
  --network       Run only network tests

Environment:
  K8S_NAMESPACE     Kubernetes namespace (default: agenthive)
  API_URL           API URL (default: http://localhost:8080)
  BASE_URL          Frontend URL (default: http://localhost:8080)

Examples:
  $0                # Run all tests
  $0 --pre          # Run only prerequisites
  K8S_NAMESPACE=dev $0  # Use different namespace

EOF
}

run_all_tests() {
    print_header
    
    # 前置条件
    test_kubectl_version
    test_cluster_connection
    test_kustomize
    test_namespace
    
    # 配置
    test_configmaps
    test_secrets
    
    # 数据库
    test_postgres_deployment
    test_postgres_service
    test_redis_deployment
    test_redis_service
    
    # 应用
    test_supervisor_deployment
    test_supervisor_service
    test_web_deployment
    test_web_service
    
    # Pod 和网络
    test_pod_status
    test_ingress
    test_ingress_controller
    test_hpa
    test_endpoints
    
    # 配置验证
    test_health_checks
    test_resource_limits
    
    # 功能测试
    test_api_health
    test_api_agents
    test_api_tasks
    test_frontend
    
    # 监控
    test_events
    test_logs
    
    print_summary
}

run_prerequisite_tests() {
    print_header
    test_kubectl_version
    test_cluster_connection
    test_kustomize
    test_namespace
    print_summary
}

run_resource_tests() {
    print_header
    test_configmaps
    test_secrets
    test_postgres_deployment
    test_postgres_service
    test_redis_deployment
    test_redis_service
    test_supervisor_deployment
    test_supervisor_service
    test_web_deployment
    test_web_service
    test_pod_status
    test_hpa
    print_summary
}

run_network_tests() {
    print_header
    test_ingress
    test_ingress_controller
    test_endpoints
    test_health_checks
    test_resource_limits
    print_summary
}

run_api_tests() {
    print_header
    test_api_health
    test_api_agents
    test_api_tasks
    test_frontend
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
        --resources)
            run_resource_tests
            exit $?
            ;;
        --api)
            run_api_tests
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
