#!/bin/bash
# ==========================================
# AgentHive Cloud - Local Kubernetes Deploy Script
# For Docker Desktop Kubernetes
# ==========================================

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="agenthive-local"
WEB_IMAGE="agenthive/web:local"
SUPERVISOR_IMAGE="agenthive/supervisor:local"
WEB_PORT="30080"
API_PORT="30808"

# Functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  AgentHive Cloud - Local K8s Deploy${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker installed"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    print_success "kubectl installed"
    
    # Check K8s cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Kubernetes cluster is not running"
        echo "   Please ensure Docker Desktop Kubernetes is enabled"
        exit 1
    fi
    print_success "Kubernetes cluster is accessible"
    
    # Check Docker Desktop K8s context
    CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "unknown")
    print_info "Current context: $CURRENT_CONTEXT"
    
    echo ""
}

build_images() {
    print_info "Building Docker images..."
    
    # Build supervisor image
    print_info "Building supervisor image..."
    docker build -t "$SUPERVISOR_IMAGE" -f apps/supervisor/Dockerfile --target production apps/supervisor/
    print_success "Supervisor image built: $SUPERVISOR_IMAGE"
    
    # Build web image
    print_info "Building web image..."
    docker build -t "$WEB_IMAGE" -f apps/web/Dockerfile --target production apps/web/
    print_success "Web image built: $WEB_IMAGE"
    
    # For Docker Desktop, images are automatically available in K8s
    # For other setups (kind, minikube), we would need to load them
    if kubectl config current-context | grep -q "kind"; then
        print_info "Detected kind cluster, loading images..."
        kind load docker-image "$SUPERVISOR_IMAGE"
        kind load docker-image "$WEB_IMAGE"
    fi
    
    echo ""
}

deploy() {
    print_info "Deploying to Kubernetes..."
    
    # Apply kustomization
    kubectl apply -k k8s/local/
    
    print_success "Manifests applied"
    echo ""
}

wait_for_pods() {
    print_info "Waiting for pods to be ready..."
    
    # Wait for postgres
    print_info "Waiting for PostgreSQL..."
    kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=120s || {
        print_error "PostgreSQL failed to start"
        kubectl logs -l app=postgres -n "$NAMESPACE" --tail=50
        exit 1
    }
    print_success "PostgreSQL is ready"
    
    # Wait for redis
    print_info "Waiting for Redis..."
    kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout=120s || {
        print_error "Redis failed to start"
        kubectl logs -l app=redis -n "$NAMESPACE" --tail=50
        exit 1
    }
    print_success "Redis is ready"
    
    # Wait for supervisor
    print_info "Waiting for Supervisor API..."
    kubectl wait --for=condition=ready pod -l app=agenthive-supervisor -n "$NAMESPACE" --timeout=180s || {
        print_error "Supervisor API failed to start"
        kubectl logs -l app=agenthive-supervisor -n "$NAMESPACE" --tail=50
        exit 1
    }
    print_success "Supervisor API is ready"
    
    # Wait for web
    print_info "Waiting for Web Frontend..."
    kubectl wait --for=condition=ready pod -l app=agenthive-web -n "$NAMESPACE" --timeout=180s || {
        print_error "Web Frontend failed to start"
        kubectl logs -l app=agenthive-web -n "$NAMESPACE" --tail=50
        exit 1
    }
    print_success "Web Frontend is ready"
    
    echo ""
}

show_status() {
    print_info "Deployment Status:"
    echo ""
    
    echo -e "${BLUE}Pods:${NC}"
    kubectl get pods -n "$NAMESPACE"
    echo ""
    
    echo -e "${BLUE}Services:${NC}"
    kubectl get services -n "$NAMESPACE"
    echo ""
    
    echo -e "${BLUE}Persistent Volume Claims:${NC}"
    kubectl get pvc -n "$NAMESPACE"
    echo ""
}

show_access_info() {
    print_header
    print_success "Deployment completed successfully!"
    echo ""
    
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Access Information${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    
    # Get node IP (works for Docker Desktop, kind, minikube)
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
    
    # For Docker Desktop on Windows/Mac, use localhost
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "darwin"* ]]; then
        ACCESS_IP="localhost"
    else
        ACCESS_IP="$NODE_IP"
    fi
    
    echo -e "  Web UI:      ${YELLOW}http://${ACCESS_IP}:${WEB_PORT}${NC}"
    echo -e "  API Direct:  ${YELLOW}http://${ACCESS_IP}:${API_PORT}${NC}"
    echo ""
    
    echo -e "${BLUE}Port-forward commands (alternative access):${NC}"
    echo -e "  Web:    ${YELLOW}kubectl port-forward svc/web 8080:80 -n $NAMESPACE${NC}"
    echo -e "  API:    ${YELLOW}kubectl port-forward svc/supervisor 8081:8080 -n $NAMESPACE${NC}"
    echo ""
    
    echo -e "${BLUE}Useful commands:${NC}"
    echo -e "  View logs:     ${YELLOW}./scripts/local-k8s.sh logs${NC}"
    echo -e "  Scale app:     ${YELLOW}kubectl scale deployment web --replicas=2 -n $NAMESPACE${NC}"
    echo -e "  Shell access:  ${YELLOW}kubectl exec -it deployment/supervisor -n $NAMESPACE -- /bin/sh${NC}"
    echo -e "  Delete all:    ${YELLOW}./scripts/local-k8s.sh delete${NC}"
    echo ""
}

show_logs() {
    print_info "Showing logs for all pods..."
    echo ""
    
    echo -e "${BLUE}--- PostgreSQL Logs ---${NC}"
    kubectl logs -l app=postgres -n "$NAMESPACE" --tail=20
    echo ""
    
    echo -e "${BLUE}--- Redis Logs ---${NC}"
    kubectl logs -l app=redis -n "$NAMESPACE" --tail=20
    echo ""
    
    echo -e "${BLUE}--- Supervisor Logs ---${NC}"
    kubectl logs -l app=agenthive-supervisor -n "$NAMESPACE" --tail=20
    echo ""
    
    echo -e "${BLUE}--- Web Logs ---${NC}"
    kubectl logs -l app=agenthive-web -n "$NAMESPACE" --tail=20
    echo ""
}

delete_deployment() {
    print_warning "This will delete all resources in namespace $NAMESPACE"
    read -p "Are you sure? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deleting deployment..."
        kubectl delete -k k8s/local/
        print_success "Deployment deleted"
    else
        print_info "Deletion cancelled"
    fi
}

watch_pods() {
    print_info "Watching pods (Ctrl+C to exit)..."
    kubectl get pods -n "$NAMESPACE" -w
}

quick_reload() {
    print_info "Quick reload - rebuilding and redeploying apps..."
    
    # Rebuild images
    build_images
    
    # Restart deployments
    print_info "Restarting deployments..."
    kubectl rollout restart deployment/supervisor -n "$NAMESPACE"
    kubectl rollout restart deployment/web -n "$NAMESPACE"
    
    # Wait for rollout
    print_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/supervisor -n "$NAMESPACE" --timeout=120s
    kubectl rollout status deployment/web -n "$NAMESPACE" --timeout=120s
    
    print_success "Reload complete!"
}

# Main command handler
case "${1:-deploy}" in
    deploy)
        print_header
        check_prerequisites
        build_images
        deploy
        wait_for_pods
        show_status
        show_access_info
        ;;
    build)
        print_header
        check_prerequisites
        build_images
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    delete)
        delete_deployment
        ;;
    watch)
        watch_pods
        ;;
    reload)
        quick_reload
        ;;
    port-forward)
        print_info "Starting port-forward (Ctrl+C to exit)..."
        kubectl port-forward svc/web 8080:80 -n "$NAMESPACE" &
        WEB_PID=$!
        kubectl port-forward svc/supervisor 8081:8080 -n "$NAMESPACE" &
        API_PID=$!
        
        echo ""
        echo -e "  Web UI: ${YELLOW}http://localhost:8080${NC}"
        echo -e "  API:    ${YELLOW}http://localhost:8081${NC}"
        echo ""
        
        # Wait for interrupt
        trap "kill $WEB_PID $API_PID 2>/dev/null; exit" INT
        wait
        ;;
    help|--help|-h)
        echo "AgentHive Cloud - Local Kubernetes Deploy Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy        Full deployment (default)"
        echo "  build         Build Docker images only"
        echo "  status        Show deployment status"
        echo "  logs          Show logs from all pods"
        echo "  delete        Delete all K8s resources"
        echo "  watch         Watch pods in real-time"
        echo "  reload        Quick reload (rebuild + restart)"
        echo "  port-forward  Start port-forwarding for local access"
        echo "  help          Show this help message"
        echo ""
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac
