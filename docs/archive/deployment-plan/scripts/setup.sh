#!/bin/bash
# AgentHive Cloud 部署环境初始化脚本
# 一键设置完整的 Kubernetes 集群

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="agenthive-prod"
AWS_REGION="ap-southeast-1"
K8S_VERSION="1.29"
NAMESPACE="agenthive"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[SETUP]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# 前置检查
# ============================================================================
check_prerequisites() {
    log "检查前置条件..."
    
    local tools=("aws" "eksctl" "kubectl" "helm" "jq")
    local missing=()
    
    for tool in "${tools[@]}"; do
        if ! command -v $tool &>/dev/null; then
            missing+=($tool)
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        error "缺少以下工具: ${missing[*]}"
        echo "请安装:"
        echo "  - AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
        echo "  - eksctl: https://eksctl.io/installation/"
        echo "  - kubectl: https://kubernetes.io/docs/tasks/tools/"
        echo "  - Helm: https://helm.sh/docs/intro/install/"
        echo "  - jq: https://stedolan.github.io/jq/download/"
        exit 1
    fi
    
    # 检查 AWS 凭证
    if ! aws sts get-caller-identity &>/dev/null; then
        error "AWS 凭证无效或未配置"
        exit 1
    fi
    
    success "前置条件检查通过"
}

# ============================================================================
# 创建 EKS 集群
# ============================================================================
create_cluster() {
    log "创建 EKS 集群: $CLUSTER_NAME..."
    
    if eksctl get cluster --name $CLUSTER_NAME --region $AWS_REGION &>/dev/null; then
        warn "集群 $CLUSTER_NAME 已存在，跳过创建"
        return
    fi
    
    eksctl create cluster \
        --name $CLUSTER_NAME \
        --region $AWS_REGION \
        --version $K8S_VERSION \
        --nodegroup-name system-ng \
        --node-type t3.medium \
        --nodes 2 \
        --nodes-min 2 \
        --nodes-max 4 \
        --node-private-networking \
        --managed \
        --with-oidc \
        --ssh-access=false \
        --tags "Environment=production,Project=agenthive"
    
    success "集群创建完成"
}

# ============================================================================
# 添加节点组
# ============================================================================
add_nodegroups() {
    log "添加应用节点组..."
    
    # Spot 节点组
    if ! eksctl get nodegroup --cluster $CLUSTER_NAME --name app-spot-ng &>/dev/null; then
        eksctl create nodegroup \
            --cluster $CLUSTER_NAME \
            --name app-spot-ng \
            --node-type t3.large \
            --nodes 3 \
            --nodes-min 2 \
            --nodes-max 20 \
            --node-private-networking \
            --managed \
            --spot \
            --node-labels "workload-type=app,cost-optimization=spot" \
            --asg-access
        success "Spot 节点组添加完成"
    else
        warn "Spot 节点组已存在"
    fi
    
    # Agent Runtime 节点组
    if ! eksctl get nodegroup --cluster $CLUSTER_NAME --name agent-runtime-ng &>/dev/null; then
        eksctl create nodegroup \
            --cluster $CLUSTER_NAME \
            --name agent-runtime-ng \
            --node-type r6i.xlarge \
            --nodes 2 \
            --nodes-min 1 \
            --nodes-max 10 \
            --node-private-networking \
            --managed \
            --node-labels "workload-type=agent-runtime" \
            --node-taints "dedicated=agent-runtime:NoSchedule"
        success "Agent Runtime 节点组添加完成"
    else
        warn "Agent Runtime 节点组已存在"
    fi
}

# ============================================================================
# 安装基础组件
# ============================================================================
install_base_components() {
    log "安装基础组件..."
    
    # 添加 Helm 仓库
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add jetstack https://charts.jetstack.io
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add kedacore https://kedacore.github.io/charts
    helm repo update
    
    # 创建命名空间
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    success "Helm 仓库配置完成"
}

# ============================================================================
# 安装 Ingress-Nginx
# ============================================================================
install_ingress() {
    log "安装 Ingress-Nginx..."
    
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"=nlb \
        --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-scheme"=internet-facing \
        --set controller.metrics.enabled=true \
        --set controller.podAnnotations."prometheus\.io/scrape"=true \
        --set controller.podAnnotations."prometheus\.io/port"=10254 \
        --wait
    
    success "Ingress-Nginx 安装完成"
}

# ============================================================================
# 安装 Cert-Manager
# ============================================================================
install_cert_manager() {
    log "安装 Cert-Manager..."
    
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --set installCRDs=true \
        --wait
    
    # 等待 cert-manager 就绪
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=cert-manager -n cert-manager --timeout=120s
    
    success "Cert-Manager 安装完成"
}

# ============================================================================
# 安装 External Secrets
# ============================================================================
install_external_secrets() {
    log "安装 External Secrets Operator..."
    
    helm upgrade --install external-secrets external-secrets/external-secrets \
        --namespace external-secrets \
        --create-namespace \
        --set installCRDs=true \
        --wait
    
    success "External Secrets 安装完成"
}

# ============================================================================
# 安装监控栈
# ============================================================================
install_monitoring() {
    log "安装 Prometheus + Grafana..."
    
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.enabled=true \
        --set grafana.adminPassword=admin \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp2 \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
        --wait
    
    # 安装 Loki
    helm upgrade --install loki grafana/loki-stack \
        --namespace monitoring \
        --set promtail.enabled=true \
        --set grafana.enabled=false \
        --wait
    
    success "监控栈安装完成"
    
    # 获取 Grafana 访问信息
    local grafana_url=$(kubectl get svc prometheus-grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    log "Grafana 访问地址: http://$grafana_url"
    log "用户名: admin, 密码: admin"
}

# ============================================================================
# 安装 KEDA
# ============================================================================
install_keda() {
    log "安装 KEDA..."
    
    helm upgrade --install keda kedacore/keda \
        --namespace keda \
        --create-namespace \
        --wait
    
    success "KEDA 安装完成"
}

# ============================================================================
# 安装 ArgoCD
# ============================================================================
install_argocd() {
    log "安装 ArgoCD..."
    
    helm upgrade --install argocd argo/argo-cd \
        --namespace argocd \
        --create-namespace \
        --set server.service.type=LoadBalancer \
        --set configs.params."server\.insecure"=true \
        --wait
    
    # 获取初始密码
    local argocd_password=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
    local argocd_url=$(kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    success "ArgoCD 安装完成"
    log "ArgoCD 访问地址: https://$argocd_url"
    log "用户名: admin, 密码: $argocd_password"
}

# ============================================================================
# 配置 IAM 角色
# ============================================================================
setup_iam() {
    log "配置 IAM 角色..."
    
    # 创建 IAM OIDC 提供商
    eksctl utils associate-iam-oidc-provider \
        --cluster $CLUSTER_NAME \
        --region $AWS_REGION \
        --approve
    
    # 为 External Secrets 创建 IAM 角色
    eksctl create iamserviceaccount \
        --name external-secrets-sa \
        --namespace external-secrets \
        --cluster $CLUSTER_NAME \
        --region $AWS_REGION \
        --attach-policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite \
        --approve
    
    success "IAM 角色配置完成"
}

# ============================================================================
# 验证安装
# ============================================================================
verify_installation() {
    log "验证安装..."
    
    local checks=(
        "cert-manager:cert-manager"
        "external-secrets:external-secrets"
        "prometheus:monitoring"
        "keda:keda"
    )
    
    for check in "${checks[@]}"; do
        local name=$(echo $check | cut -d: -f1)
        local ns=$(echo $check | cut -d: -f2)
        
        if kubectl get pods -n $ns -l app.kubernetes.io/name=$name &>/dev/null; then
            success "$name 运行正常"
        else
            warn "$name 可能未正常运行，请检查"
        fi
    done
}

# ============================================================================
# 主函数
# ============================================================================
main() {
    local command=${1:-all}
    
    case $command in
        check)
            check_prerequisites
            ;;
        cluster)
            check_prerequisites
            create_cluster
            add_nodegroups
            setup_iam
            ;;
        base)
            check_prerequisites
            install_base_components
            ;;
        ingress)
            install_ingress
            ;;
        cert-manager)
            install_cert_manager
            ;;
        external-secrets)
            install_external_secrets
            ;;
        monitoring)
            install_monitoring
            ;;
        keda)
            install_keda
            ;;
        argocd)
            install_argocd
            ;;
        verify)
            verify_installation
            ;;
        all|*)
            log "开始完整安装流程..."
            check_prerequisites
            create_cluster
            add_nodegroups
            setup_iam
            install_base_components
            install_ingress
            install_cert_manager
            install_external_secrets
            install_monitoring
            install_keda
            verify_installation
            
            success "安装完成！"
            echo ""
            echo "后续步骤:"
            echo "1. 配置 DNS 指向 Ingress IP"
            echo "2. 创建 External Secrets (参考 external-secrets.yaml)"
            echo "3. 部署应用 (使用 deploy-helper.sh 或 ArgoCD)"
            echo ""
            echo "常用命令:"
            echo "  kubectl get svc -n ingress-nginx  # 查看 Ingress IP"
            echo "  kubectl get pods -n $NAMESPACE    # 查看应用状态"
            ;;
    esac
}

main "$@"
