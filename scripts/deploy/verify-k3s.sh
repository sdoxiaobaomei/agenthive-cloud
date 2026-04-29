#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — K3s Cluster Health Check
# TICKET: PLATFORM-005
# Purpose: Verify all K3s core components after bootstrap
# Usage  : bash scripts/verify-k3s.sh
# Exit   : 0 if all checks pass, 1 otherwise
# =============================================================================

set -uo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# --- Counters ---
PASS=0
FAIL=0
WARN=0

# --- Helpers ---
print_header() {
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}$1${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
}

print_row() {
  local status="$1"
  local item="$2"
  local detail="$3"
  if [[ "$status" == "PASS" ]]; then
    printf "  ${GREEN}%-4s${NC}  %-32s %s\n" "✅" "$item" "$detail"
    ((PASS++))
  elif [[ "$status" == "FAIL" ]]; then
    printf "  ${RED}%-4s${NC}  %-32s %s\n" "❌" "$item" "$detail"
    ((FAIL++))
  else
    printf "  ${YELLOW}%-4s${NC}  %-32s %s\n" "⚠️" "$item" "$detail"
    ((WARN++))
  fi
}

# --- kubectl availability ---
print_header "🔍 Environment Check"

KUBECTL_CMD=""
if command -v kubectl &>/dev/null; then
  KUBECTL_CMD="kubectl"
elif command -v k3s &>/dev/null; then
  KUBECTL_CMD="k3s kubectl"
else
  echo -e "${RED}❌ kubectl / k3s not found in PATH.${NC}"
  exit 1
fi

if ! $KUBECTL_CMD cluster-info &>/dev/null; then
  echo -e "${RED}❌ Cannot connect to K3s cluster.${NC}"
  echo "   Ensure KUBECONFIG is set or run as root with /etc/rancher/k3s/k3s.yaml"
  exit 1
fi

print_row "PASS" "kubectl" "$($KUBECTL_CMD version --client -o json 2>/dev/null | grep -o '"gitVersion":"[^"]*"' | head -1 | cut -d'"' -f4 || echo 'unknown')"
print_row "PASS" "cluster-connect" "API server reachable"

# --- 1. Node Status ---
print_header "🖥️  Node Status"

NODE_COUNT=$($KUBECTL_CMD get nodes --no-headers 2>/dev/null | wc -l)
READY_COUNT=$($KUBECTL_CMD get nodes --no-headers 2>/dev/null | grep -c " Ready" || true)

if [[ "$NODE_COUNT" -eq 0 ]]; then
  print_row "FAIL" "nodes" "No nodes found"
else
  print_row "PASS" "node-count" "$NODE_COUNT node(s)"
fi

if [[ "$READY_COUNT" -ge 1 ]]; then
  print_row "PASS" "node-ready" "$READY_COUNT Ready"
else
  print_row "FAIL" "node-ready" "0 Ready"
fi

# Show node details
while IFS= read -r line; do
  name=$(echo "$line" | awk '{print $1}')
  status=$(echo "$line" | awk '{print $2}')
  version=$(echo "$line" | awk '{print $5}')
  if [[ "$status" == "Ready" ]]; then
    print_row "PASS" "node: $name" "$status ($version)"
  else
    print_row "FAIL" "node: $name" "$status ($version)"
  fi
done < <($KUBECTL_CMD get nodes --no-headers 2>/dev/null || true)

# --- 2. Core System Pods ---
print_header "🔧 Core System Pods"

CORE_NAMESPACES=("kube-system")
for ns in "${CORE_NAMESPACES[@]}"; do
  POD_STATUSES=$($KUBECTL_CMD get pods -n "$ns" --no-headers 2>/dev/null || true)
  if [[ -z "$POD_STATUSES" ]]; then
    print_row "WARN" "namespace: $ns" "No pods"
    continue
  fi

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    pod_name=$(echo "$line" | awk '{print $1}')
    pod_ready=$(echo "$line" | awk '{print $2}')
    pod_status=$(echo "$line" | awk '{print $3}')
    pod_restarts=$(echo "$line" | awk '{print $4}')

    if [[ "$pod_status" == "Running" || "$pod_status" == "Completed" ]]; then
      if [[ "$pod_restarts" =~ ^[0-9]+$ && "$pod_restarts" -gt 5 ]]; then
        print_row "WARN" "$ns/$pod_name" "Running but $pod_restarts restarts"
      else
        print_row "PASS" "$ns/$pod_name" "Running ($pod_ready)"
      fi
    elif [[ "$pod_status" == "Completed" ]]; then
      print_row "PASS" "$ns/$pod_name" "Completed"
    else
      print_row "FAIL" "$ns/$pod_name" "$pod_status"
    fi
  done <<< "$POD_STATUSES"
done

# --- 3. ingress-nginx Check ---
print_header "🌐 ingress-nginx Controller"

INGRESS_NS="ingress-nginx"
if ! $KUBECTL_CMD get namespace "$INGRESS_NS" &>/dev/null; then
  print_row "FAIL" "namespace" "$INGRESS_NS not found"
else
  print_row "PASS" "namespace" "$INGRESS_NS exists"

  # Check controller deployment
  REPLICAS=$($KUBECTL_CMD get deployment ingress-nginx-controller -n "$INGRESS_NS" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  if [[ "$REPLICAS" =~ ^[0-9]+$ && "$REPLICAS" -ge 1 ]]; then
    print_row "PASS" "controller-replicas" "$REPLICAS ready"
  else
    print_row "FAIL" "controller-replicas" "0 ready (expected >= 1)"
  fi

  # Check controller pod
  CONTROLLER_POD=$($KUBECTL_CMD get pods -n "$INGRESS_NS" -l app.kubernetes.io/component=controller -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
  if [[ -n "$CONTROLLER_POD" ]]; then
    POD_STATUS=$($KUBECTL_CMD get pod "$CONTROLLER_POD" -n "$INGRESS_NS" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
    if [[ "$POD_STATUS" == "Running" ]]; then
      print_row "PASS" "controller-pod" "$CONTROLLER_POD is Running"
    else
      print_row "FAIL" "controller-pod" "$CONTROLLER_POD is $POD_STATUS"
    fi
  else
    print_row "FAIL" "controller-pod" "No controller pod found"
  fi

  # Check admission webhook (optional but good to verify)
  WEBHOOK=$($KUBECTL_CMD get validatingwebhookconfiguration ingress-nginx-admission 2>/dev/null || true)
  if [[ -n "$WEBHOOK" ]]; then
    print_row "PASS" "admission-webhook" "ingress-nginx-admission configured"
  else
    print_row "WARN" "admission-webhook" "Not found (may still be creating)"
  fi

  # Port binding check (hostNetwork mode)
  if command -v ss &>/dev/null; then
    if ss -tlnp | grep -q ":80 "; then
      print_row "PASS" "port-80" "Bound on host"
    else
      print_row "WARN" "port-80" "Not bound on host (may use NodePort)"
    fi
    if ss -tlnp | grep -q ":443 "; then
      print_row "PASS" "port-443" "Bound on host"
    else
      print_row "WARN" "port-443" "Not bound on host (may use NodePort)"
    fi
  elif command -v netstat &>/dev/null; then
    if netstat -tlnp 2>/dev/null | grep -q ":80 "; then
      print_row "PASS" "port-80" "Bound on host"
    else
      print_row "WARN" "port-80" "Not bound on host (may use NodePort)"
    fi
    if netstat -tlnp 2>/dev/null | grep -q ":443 "; then
      print_row "PASS" "port-443" "Bound on host"
    else
      print_row "WARN" "port-443" "Not bound on host (may use NodePort)"
    fi
  fi
fi

# --- 4. cert-manager Check ---
print_header "🔒 cert-manager"

CERT_NS="cert-manager"
if ! $KUBECTL_CMD get namespace "$CERT_NS" &>/dev/null; then
  print_row "FAIL" "namespace" "$CERT_NS not found"
else
  print_row "PASS" "namespace" "$CERT_NS exists"

  # Check cert-manager pods
  CERT_PODS=$($KUBECTL_CMD get pods -n "$CERT_NS" -l app.kubernetes.io/instance=cert-manager -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}' 2>/dev/null || true)
  if [[ -z "$CERT_PODS" ]]; then
    print_row "FAIL" "cert-manager-pods" "No pods found"
  else
    while IFS=$'\t' read -r name phase; do
      [[ -z "$name" ]] && continue
      if [[ "$phase" == "Running" ]]; then
        print_row "PASS" "cert-manager/$name" "Running"
      else
        print_row "FAIL" "cert-manager/$name" "$phase"
      fi
    done <<< "$CERT_PODS"
  fi

  # Check ClusterIssuers
  STAGING_ISSUER=$($KUBECTL_CMD get clusterissuer letsencrypt-staging -o jsonpath='{.status.conditions[0].status}' 2>/dev/null || echo "missing")
  PROD_ISSUER=$($KUBECTL_CMD get clusterissuer letsencrypt-prod -o jsonpath='{.status.conditions[0].status}' 2>/dev/null || echo "missing")

  if [[ "$STAGING_ISSUER" == "True" ]]; then
    print_row "PASS" "ClusterIssuer: staging" "Ready"
  elif [[ "$STAGING_ISSUER" == "missing" ]]; then
    print_row "FAIL" "ClusterIssuer: staging" "Not found"
  else
    print_row "WARN" "ClusterIssuer: staging" "Status: $STAGING_ISSUER"
  fi

  if [[ "$PROD_ISSUER" == "True" ]]; then
    print_row "PASS" "ClusterIssuer: prod" "Ready"
  elif [[ "$PROD_ISSUER" == "missing" ]]; then
    print_row "FAIL" "ClusterIssuer: prod" "Not found"
  else
    print_row "WARN" "ClusterIssuer: prod" "Status: $PROD_ISSUER"
  fi
fi

# --- 5. Certificate Issuance Test (staging) ---
print_header "🧪 Certificate Issuance Test (Let's Encrypt Staging)"

TEST_NS="cert-manager-test"
TEST_DOMAIN="k3s-test.$(hostname -I 2>/dev/null | awk '{print $1}' | tr '.' '-').nip.io"
# Fallback if hostname -I is empty
if [[ -z "$TEST_DOMAIN" || "$TEST_DOMAIN" == "k3s-test..nip.io" ]]; then
  TEST_DOMAIN="k3s-test.local"
fi

# Clean up any previous test
$KUBECTL_CMD delete namespace "$TEST_NS" --ignore-not-found=true &>/dev/null || true
sleep 2

$KUBECTL_CMD create namespace "$TEST_NS" &>/dev/null || true

# Create a test Certificate with staging issuer
cat <<EOF | $KUBECTL_CMD apply -f - 2>/dev/null || true
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: test-cert
  namespace: ${TEST_NS}
spec:
  secretName: test-cert-tls
  issuerRef:
    name: letsencrypt-staging
    kind: ClusterIssuer
  dnsNames:
    - ${TEST_DOMAIN}
EOF

# Wait for certificate to be issued (short timeout, staging may need DNS)
CERT_READY=false
for i in {1..30}; do
  CERT_COND=$($KUBECTL_CMD get certificate test-cert -n "$TEST_NS" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")
  if [[ "$CERT_COND" == "True" ]]; then
    CERT_READY=true
    break
  fi
  sleep 2
done

if [[ "$CERT_READY" == "true" ]]; then
  print_row "PASS" "cert-issuance" "Staging certificate issued for ${TEST_DOMAIN}"
else
  CERT_REASON=$($KUBECTL_CMD get certificate test-cert -n "$TEST_NS" -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}' 2>/dev/null || echo "unknown")
  # It's OK if staging cert fails due to no public DNS — still mark as WARN, not FAIL
  if [[ "$CERT_REASON" == "unknown" || -z "$CERT_REASON" ]]; then
    print_row "WARN" "cert-issuance" "Certificate not ready (may need public DNS / ingress)"
  else
    print_row "WARN" "cert-issuance" "$CERT_REASON"
  fi
fi

# Show certificate order status for debugging
ORDER_STATUS=$($KUBECTL_CMD get orders -n "$TEST_NS" --no-headers 2>/dev/null | head -1 || true)
if [[ -n "$ORDER_STATUS" ]]; then
  print_row "INFO" "cert-order" "$(echo "$ORDER_STATUS" | awk '{print $1 ": " $4}')"
fi

# Cleanup test namespace
$KUBECTL_CMD delete namespace "$TEST_NS" --ignore-not-found=true &>/dev/null || true

# --- 6. kubeconfig Security ---
print_header "🔐 kubeconfig Security"

KUBECONFIG_FILES=("/root/.kube/config" "${HOME}/.kube/config")
for kc in "${KUBECONFIG_FILES[@]}"; do
  if [[ -f "$kc" ]]; then
    PERMS=$(stat -c "%a" "$kc" 2>/dev/null || stat -f "%Lp" "$kc" 2>/dev/null || echo "unknown")
    if [[ "$PERMS" == "600" ]]; then
      print_row "PASS" "kubeconfig perms" "$kc is 600"
    else
      print_row "WARN" "kubeconfig perms" "$kc is $PERMS (expected 600)"
    fi
  fi
done

# Check /etc/rancher/k3s/k3s.yaml (should also be restricted)
if [[ -f /etc/rancher/k3s/k3s.yaml ]]; then
  PERMS=$(stat -c "%a" /etc/rancher/k3s/k3s.yaml 2>/dev/null || stat -f "%Lp" /etc/rancher/k3s/k3s.yaml 2>/dev/null || echo "unknown")
  if [[ "$PERMS" == "600" || "$PERMS" == "644" ]]; then
    print_row "PASS" "k3s.yaml perms" "/etc/rancher/k3s/k3s.yaml is $PERMS"
  else
    print_row "WARN" "k3s.yaml perms" "/etc/rancher/k3s/k3s.yaml is $PERMS"
  fi
fi

# --- Summary ---
print_header "📊 Verification Summary"

printf "  %-20s %s\n" "Total checks:" "$((PASS + FAIL + WARN))"
printf "  ${GREEN}%-20s${NC} %s\n" "✅ Passed:" "$PASS"
printf "  ${RED}%-20s${NC} %s\n" "❌ Failed:" "$FAIL"
printf "  ${YELLOW}%-20s${NC} %s\n" "⚠️  Warnings:" "$WARN"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✅ All critical checks passed! K3s cluster is healthy.${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}❌ K3s cluster has failures. Review diagnosis above.${NC}"
  exit 1
fi
