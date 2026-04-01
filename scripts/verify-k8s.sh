#!/bin/bash
# ==========================================
# AgentHive Cloud - Kubernetes Environment Verification
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

check_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Kubernetes Environment Verification${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check Docker
echo -e "${BLUE}Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
    check_pass "Docker installed ($DOCKER_VERSION)"
else
    check_fail "Docker not installed"
fi

if docker info &> /dev/null; then
    check_pass "Docker daemon is running"
else
    check_fail "Docker daemon is not running"
fi
echo ""

# Check kubectl
echo -e "${BLUE}Checking kubectl...${NC}"
if command -v kubectl &> /dev/null; then
    KUBECTL_VERSION=$(kubectl version --client -o json 2>/dev/null | grep -o '"gitVersion": "[^"]*"' | head -1 | cut -d'"' -f4)
    check_pass "kubectl installed ($KUBECTL_VERSION)"
else
    check_fail "kubectl not installed"
    exit 1
fi
echo ""

# Check Kubernetes cluster
echo -e "${BLUE}Checking Kubernetes cluster...${NC}"
if kubectl cluster-info &> /dev/null; then
    check_pass "Kubernetes cluster is accessible"
    
    # Show cluster info
    CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "unknown")
    check_info "Current context: $CURRENT_CONTEXT"
    
    # Show server version
    SERVER_VERSION=$(kubectl version -o json 2>/dev/null | grep -o '"gitVersion": "[^"]*"' | head -1 | cut -d'"' -f4)
    check_info "Server version: $SERVER_VERSION"
else
    check_fail "Kubernetes cluster is not accessible"
    check_info "Please ensure Docker Desktop Kubernetes is enabled"
    exit 1
fi
echo ""

# Check nodes
echo -e "${BLUE}Checking cluster nodes...${NC}"
NODE_COUNT=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | wc -w)
if [ "$NODE_COUNT" -gt 0 ]; then
    check_pass "Found $NODE_COUNT node(s)"
    kubectl get nodes
else
    check_fail "No nodes found in cluster"
fi
echo ""

# Check StorageClass
echo -e "${BLUE}Checking Storage Classes...${NC}"
if kubectl get storageclass &> /dev/null; then
    check_pass "Storage Classes available"
    kubectl get storageclass
else
    check_warn "No Storage Classes found"
    check_info "Local deployment may need local-path storage class"
fi
echo ""

# Check if namespace exists
echo -e "${BLUE}Checking AgentHive namespace...${NC}"
if kubectl get namespace agenthive-local &> /dev/null; then
    check_pass "Namespace 'agenthive-local' exists"
    
    # Check pods
    POD_COUNT=$(kubectl get pods -n agenthive-local -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w)
    if [ "$POD_COUNT" -gt 0 ]; then
        check_info "Found $POD_COUNT pod(s) running"
        kubectl get pods -n agenthive-local
    else
        check_warn "No pods found in namespace"
    fi
else
    check_info "Namespace 'agenthive-local' does not exist (run deploy first)"
fi
echo ""

# Check Ingress Controller
echo -e "${BLUE}Checking Ingress Controller...${NC}"
if kubectl get namespace ingress-nginx &> /dev/null; then
    if kubectl get deployment ingress-nginx-controller -n ingress-nginx &> /dev/null; then
        check_pass "NGINX Ingress Controller is installed"
    else
        check_warn "Ingress Controller namespace exists but controller not found"
    fi
else
    check_warn "Ingress Controller not installed (optional)"
    check_info "Run: ./scripts/install-ingress.sh to install"
fi
echo ""

# Check Skaffold (optional)
echo -e "${BLUE}Checking optional tools...${NC}"
if command -v skaffold &> /dev/null; then
    SKAFFOLD_VERSION=$(skaffold version)
    check_pass "Skaffold installed ($SKAFFOLD_VERSION)"
else
    check_warn "Skaffold not installed (optional, for fast iteration)"
fi

if command -v helm &> /dev/null; then
    HELM_VERSION=$(helm version --short 2>/dev/null || echo "unknown")
    check_pass "Helm installed ($HELM_VERSION)"
else
    check_warn "Helm not installed (optional)"
fi
echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo -e "Your environment is ready for local Kubernetes deployment."
    echo ""
    echo -e "Run ${YELLOW}./scripts/local-k8s.sh deploy${NC} to deploy AgentHive Cloud."
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
