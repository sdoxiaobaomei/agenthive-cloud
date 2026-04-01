#!/bin/bash
# ==========================================
# AgentHive Cloud - Test K8s Deployment
# Quick smoke tests for local deployment
# ==========================================

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

NAMESPACE="agenthive-local"
WEB_PORT="30080"
API_PORT="30808"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Deployment Smoke Tests${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Determine access URL
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "darwin"* ]]; then
    BASE_URL="http://localhost"
else
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
    BASE_URL="http://${NODE_IP}"
fi

WEB_URL="${BASE_URL}:${WEB_PORT}"
API_URL="${BASE_URL}:${API_PORT}"

TESTS_PASSED=0
TESTS_FAILED=0

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

# Test 1: Check all pods are running
echo -e "${BLUE}Test 1: Checking pod status...${NC}"
PODS_RUNNING=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].status.phase}' | grep -o "Running" | wc -l)
if [ "$PODS_RUNNING" -ge 4 ]; then
    test_pass "All pods are running ($PODS_RUNNING pods)"
else
    test_fail "Not all pods are running (found $PODS_RUNNING running pods)"
    kubectl get pods -n "$NAMESPACE"
fi
echo ""

# Test 2: Check services
echo -e "${BLUE}Test 2: Checking services...${NC}"
REQUIRED_SERVICES=("postgres" "redis" "supervisor" "web")
for svc in "${REQUIRED_SERVICES[@]}"; do
    if kubectl get svc "$svc" -n "$NAMESPACE" &> /dev/null; then
        test_pass "Service '$svc' exists"
    else
        test_fail "Service '$svc' not found"
    fi
done
echo ""

# Test 3: Test Web UI health endpoint
echo -e "${BLUE}Test 3: Testing Web UI health...${NC}"
if curl -sf "${WEB_URL}/health" &> /dev/null; then
    test_pass "Web UI health check passed"
else
    test_fail "Web UI health check failed"
fi
echo ""

# Test 4: Test API health endpoint
echo -e "${BLUE}Test 4: Testing API health...${NC}"
if curl -sf "${API_URL}/health" &> /dev/null; then
    test_pass "API health check passed"
else
    test_fail "API health check failed"
fi
echo ""

# Test 5: Test API main endpoint
echo -e "${BLUE}Test 5: Testing API endpoints...${NC}"
API_RESPONSE=$(curl -sf "${API_URL}/api/health" -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
if [ "$API_RESPONSE" = "200" ]; then
    test_pass "API /api/health endpoint responded with 200"
else
    test_fail "API /api/health endpoint failed (status: $API_RESPONSE)"
fi
echo ""

# Test 6: Check database connectivity (via API)
echo -e "${BLUE}Test 6: Testing database connectivity...${NC}"
# This assumes API has a health endpoint that checks DB
if curl -sf "${API_URL}/health" | grep -q "healthy\|ok\|up" 2>/dev/null; then
    test_pass "Database connectivity check passed"
else
    test_warn "Could not verify database connectivity"
fi
echo ""

# Test 7: Check PVCs
echo -e "${BLUE}Test 7: Checking persistent volumes...${NC}"
if kubectl get pvc -n "$NAMESPACE" | grep -q "Bound"; then
    test_pass "Persistent volumes are bound"
else
    test_warn "No bound persistent volumes found"
fi
echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo -e "Application is accessible at:"
    echo -e "  Web UI: ${YELLOW}${WEB_URL}${NC}"
    echo -e "  API:    ${YELLOW}${API_URL}${NC}"
    echo ""
    echo -e "Try these commands:"
    echo -e "  View logs:  ${YELLOW}./scripts/local-k8s.sh logs${NC}"
    echo -e "  Open shell: ${YELLOW}kubectl exec -it deployment/supervisor -n $NAMESPACE -- /bin/sh${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    echo -e "Check logs: ${YELLOW}./scripts/local-k8s.sh logs${NC}"
    exit 1
fi
echo -e "${BLUE}============================================${NC}"
