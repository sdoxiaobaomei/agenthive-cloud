#!/bin/bash
# AgentHive Cloud 部署助手脚本
# 简化日常部署操作

set -euo pipefail

# 配置
NAMESPACE="agenthive"
CONTEXT=""
ENVIRONMENT="production"
DRY_RUN=false
VERBOSE=false

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================================
# 检查前置条件
# ============================================================================
check_prerequisites() {
    local missing=()
    
    for cmd in kubectl helm jq aws; do
        if ! command -v $cmd &>/dev/null; then
            missing+=($cmd)
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "缺少必要工具: ${missing[*]}"
        exit 1
    fi
    
    # 检查 kubeconfig
    if ! kubectl cluster-info &>/dev/null; then
        log_error "无法连接到 Kubernetes 集群"
        exit 1
    fi
    
    log_success "前置检查通过"
}

# ============================================================================
# 部署指定服务
# ============================================================================
deploy_service() {
    local service=$1
    local version=${2:-latest}
    
    log_info "部署 $service:$version"
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY RUN] 将执行: kubectl set image deployment/$service $service=$version -n $NAMESPACE"
        return
    fi
    
    # 检查部署是否存在
    if ! kubectl get deployment $service -n $NAMESPACE &>/dev/null; then
        log_error "部署 $service 不存在"
        return 1
    fi
    
    # 执行部署
    kubectl set image deployment/$service $service=$version -n $NAMESPACE
    
    # 等待滚动更新完成
    log_info "等待滚动更新完成..."
    if kubectl rollout status deployment/$service -n $NAMESPACE --timeout=300s; then
        log_success "$service 部署成功"
    else
        log_error "$service 部署失败，执行回滚..."
        kubectl rollout undo deployment/$service -n $NAMESPACE
        return 1
    fi
}

# ============================================================================
# 健康检查
# ============================================================================
health_check() {
    log_info "执行健康检查..."
    
    local failed=0
    
    # 检查 Pod 状态
    log_info "检查 Pod 状态..."
    local not_ready=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    if [ $not_ready -gt 0 ]; then
        log_warn "有 $not_ready 个 Pod 未就绪:"
        kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running
        ((failed++))
    else
        log_success "所有 Pod 运行正常"
    fi
    
    # 检查服务端点
    log_info "检查服务端点..."
    local services=("landing" "api" "agent-runtime")
    for svc in "${services[@]}"; do
        if kubectl get endpoints $svc -n $NAMESPACE -o json | jq -e '.subsets | length > 0' &>/dev/null; then
            log_success "服务 $svc 端点正常"
        else
            log_error "服务 $svc 没有可用端点"
            ((failed++))
        fi
    done
    
    # 检查 HPA
    log_info "检查 HPA 状态..."
    local hpa_issues=$(kubectl get hpa -n $NAMESPACE --no-headers 2>/dev/null | awk '$3 == $5 {print $1}')
    if [ -n "$hpa_issues" ]; then
        log_warn "以下 HPA 已达到最大副本数:"
        echo "$hpa_issues"
    fi
    
    # HTTP 健康检查
    log_info "执行 HTTP 健康检查..."
    local api_endpoint=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].spec.rules[0].host}' 2>/dev/null)
    if [ -n "$api_endpoint" ]; then
        if curl -sf https://$api_endpoint/api/health &>/dev/null; then
            log_success "API 健康检查通过"
        else
            log_error "API 健康检查失败"
            ((failed++))
        fi
    fi
    
    if [ $failed -eq 0 ]; then
        log_success "所有健康检查通过"
        return 0
    else
        log_error "$failed 项健康检查失败"
        return 1
    fi
}

# ============================================================================
# 日志收集
# ============================================================================
collect_logs() {
    local service=$1
    local since=${2:-1h}
    local tail=${3:-100}
    
    log_info "收集 $service 日志..."
    
    # 获取 Pod 名称
    local pods=$(kubectl get pods -n $NAMESPACE -l app=$service -o name 2>/dev/null)
    
    if [ -z "$pods" ]; then
        log_error "未找到 $service 的 Pod"
        return 1
    fi
    
    # 收集日志到文件
    local log_file="/tmp/${service}-logs-$(date +%Y%m%d-%H%M%S).txt"
    
    echo "=== $service Logs ($(date)) ===" > $log_file
    echo "" >> $log_file
    
    for pod in $pods; do
        echo "--- $pod ---" >> $log_file
        kubectl logs $pod -n $NAMESPACE --since=$since --tail=$tail >> $log_file 2>&1 || true
        echo "" >> $log_file
    done
    
    log_success "日志已保存到: $log_file"
}

# ============================================================================
# 回滚服务
# ============================================================================
rollback_service() {
    local service=$1
    local revision=${2:-0}  # 0 表示上一个版本
    
    log_info "回滚 $service 到版本 $revision..."
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY RUN] 将执行: kubectl rollout undo deployment/$service --to-revision=$revision -n $NAMESPACE"
        return
    fi
    
    # 查看历史版本
    log_info "部署历史:"
    kubectl rollout history deployment/$service -n $NAMESPACE
    
    # 执行回滚
    if kubectl rollout undo deployment/$service --to-revision=$revision -n $NAMESPACE; then
        log_info "等待回滚完成..."
        if kubectl rollout status deployment/$service -n $NAMESPACE --timeout=300s; then
            log_success "$service 回滚成功"
        else
            log_error "$service 回滚后状态异常"
            return 1
        fi
    else
        log_error "$service 回滚失败"
        return 1
    fi
}

# ============================================================================
# 查看部署状态
# ============================================================================
view_status() {
    log_info "=== 部署状态概览 ==="
    
    echo ""
    echo "Deployments:"
    kubectl get deployments -n $NAMESPACE -o wide
    
    echo ""
    echo "Pods:"
    kubectl get pods -n $NAMESPACE -o wide
    
    echo ""
    echo "Services:"
    kubectl get services -n $NAMESPACE
    
    echo ""
    echo "Ingress:"
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    echo "HPA:"
    kubectl get hpa -n $NAMESPACE
    
    echo ""
    echo "资源使用:"
    kubectl top pods -n $NAMESPACE 2>/dev/null || log_warn "metrics-server 未安装"
}

# ============================================================================
# 扩展/缩减副本
# ============================================================================
scale_service() {
    local service=$1
    local replicas=$2
    
    log_info "缩放 $service 到 $replicas 个副本..."
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY RUN] 将执行: kubectl scale deployment/$service --replicas=$replicas -n $NAMESPACE"
        return
    fi
    
    kubectl scale deployment/$service --replicas=$replicas -n $NAMESPACE
    log_success "$service 已缩放到 $replicas 个副本"
}

# ============================================================================
# 重启服务
# ============================================================================
restart_service() {
    local service=$1
    
    log_info "重启 $service..."
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY RUN] 将执行: kubectl rollout restart deployment/$service -n $NAMESPACE"
        return
    fi
    
    kubectl rollout restart deployment/$service -n $NAMESPACE
    kubectl rollout status deployment/$service -n $NAMESPACE --timeout=300s
    log_success "$service 重启完成"
}

# ============================================================================
# 执行数据库迁移
# ============================================================================
db_migrate() {
    log_info "执行数据库迁移..."
    
    # 获取数据库连接信息
    local db_host=$(kubectl get secret db-credentials -n $NAMESPACE -o jsonpath='{.data.host}' | base64 -d)
    local db_pass=$(kubectl get secret db-credentials -n $NAMESPACE -o jsonpath='{.data.password}' | base64 -d)
    
    log_info "连接到数据库: $db_host"
    
    # 这里可以添加具体的迁移命令
    # 例如: kubectl exec -it deploy/api -n $NAMESPACE -- npm run migrate
    
    log_warn "请手动执行数据库迁移命令"
}

# ============================================================================
# 生成报告
# ============================================================================
generate_report() {
    local report_file="/tmp/deployment-report-$(date +%Y%m%d-%H%M%S).txt"
    
    log_info "生成部署报告..."
    
    {
        echo "========================================"
        echo "AgentHive Cloud 部署报告"
        echo "生成时间: $(date)"
        echo "命名空间: $NAMESPACE"
        echo "========================================"
        echo ""
        
        echo "部署状态:"
        echo "----------------------------------------"
        kubectl get deployments -n $NAMESPACE -o wide
        
        echo ""
        echo "Pod 状态:"
        echo "----------------------------------------"
        kubectl get pods -n $NAMESPACE -o wide
        
        echo ""
        echo "资源使用:"
        echo "----------------------------------------"
        kubectl top pods -n $NAMESPACE 2>/dev/null || echo "metrics-server 不可用"
        
        echo ""
        echo "事件 (最近10条):"
        echo "----------------------------------------"
        kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
        
    } > $report_file
    
    log_success "报告已生成: $report_file"
}

# ============================================================================
# 帮助信息
# ============================================================================
show_help() {
    cat << EOF
AgentHive Cloud 部署助手

用法: $0 [command] [options]

Commands:
  deploy <service> [version]     部署指定服务
  rollback <service> [revision]  回滚服务
  restart <service>              重启服务
  scale <service> <replicas>     缩放服务副本数
  status                         查看部署状态
  health                         执行健康检查
  logs <service> [since] [tail]  收集服务日志
  migrate                        执行数据库迁移
  report                         生成部署报告
  check                          检查前置条件

Options:
  -n, --namespace <ns>           指定命名空间 (默认: agenthive)
  -e, --environment <env>        指定环境 (dev/staging/prod)
  --dry-run                      模拟执行，不实际修改
  -v, --verbose                  详细输出
  -h, --help                     显示帮助

Examples:
  $0 deploy api v1.2.3           部署 API v1.2.3
  $0 rollback landing            回滚 Landing 到上一版本
  $0 scale agent-runtime 5       将 Agent Runtime 扩展到 5 个副本
  $0 logs api 30m 500            收集 API 最近30分钟、最后500行日志
  $0 status                      查看所有部署状态

EOF
}

# ============================================================================
# 主函数
# ============================================================================
main() {
    # 解析全局选项
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
    
    # 执行命令
    local command=${1:-help}
    shift || true
    
    case $command in
        deploy)
            [ $# -lt 1 ] && { log_error "请指定服务名称"; exit 1; }
            check_prerequisites
            deploy_service "$1" "${2:-latest}"
            ;;
        rollback)
            [ $# -lt 1 ] && { log_error "请指定服务名称"; exit 1; }
            rollback_service "$1" "${2:-0}"
            ;;
        restart)
            [ $# -lt 1 ] && { log_error "请指定服务名称"; exit 1; }
            restart_service "$1"
            ;;
        scale)
            [ $# -lt 2 ] && { log_error "请指定服务名称和副本数"; exit 1; }
            scale_service "$1" "$2"
            ;;
        status)
            view_status
            ;;
        health)
            check_prerequisites
            health_check
            ;;
        logs)
            [ $# -lt 1 ] && { log_error "请指定服务名称"; exit 1; }
            collect_logs "$1" "${2:-1h}" "${3:-100}"
            ;;
        migrate)
            db_migrate
            ;;
        report)
            generate_report
            ;;
        check)
            check_prerequisites
            ;;
        help|*)
            show_help
            ;;
    esac
}

main "$@"
