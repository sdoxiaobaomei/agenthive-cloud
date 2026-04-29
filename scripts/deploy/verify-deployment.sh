#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Deployment Verification Script
# TICKET: PLATFORM-010
# Purpose: Verify K3s deployment health after helm upgrade or rollback
# Usage  : bash scripts/verify-deployment.sh [OPTIONS]
# Exit   : 0 if all checks pass, 1 otherwise
# =============================================================================

set -uo pipefail

NAMESPACE="agenthive"
TIMEOUT=180
VERBOSE=false

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0

log_info()  { echo -e "${BLUE}ℹ️  ${NC} $1"; }
log_ok()    { echo -e "${GREEN}✅ ${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠️  ${NC} $1"; }
log_error() { echo -e "${RED}❌ ${NC} $1"; }
log_bold()  { echo -e "${BOLD}$1${NC}"; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  -n, --namespace NAMESPACE   K8s namespace (default: agenthive)
  -t, --timeout SECONDS       Health check timeout (default: 180)
  -v, --verbose               Verbose output
  -h, --help                  Show this help message
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--namespace)    NAMESPACE="$2"; shift 2 ;;
    -t|--timeout)      TIMEOUT="$2"; shift 2 ;;
    -v|--verbose)      VERBOSE=true; shift ;;
    -h|--help)         usage ;;
    *)                 log_error "Unknown option: $1"; usage ;;
  esac
done

if ! command -v kubectl &>/dev/null; then
  log_error "kubectl not found."
  exit 1
fi

check_pass() { ((PASS++)); log_ok "$1"; }
check_fail() { ((FAIL++)); log_error "$1"; }

log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  AgentHive Cloud — Deployment Verification"
log_bold "═══════════════════════════════════════════════════════════════"
log_info "Namespace: $NAMESPACE"
log_info "Timeout  : ${TIMEOUT}s"

# --- Check 1: All pods Running ---
log_bold ""
log_bold "[1/6] Pod Status"
NOT_RUNNING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running --no-headers 2>/dev/null || true)
if [[ -z "$NOT_RUNNING" ]]; then
  check_pass "All pods are Running"
else
  check_fail "Some pods are not Running:"
  echo "$NOT_RUNNING"
fi

if [[ "$VERBOSE" == "true" ]]; then
  kubectl get pods -n "$NAMESPACE" -o wide
fi

# --- Check 2: Deployments ready ---
log_bold ""
log_bold "[2/6] Deployment Readiness"
DEPLOYMENTS=$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.readyReplicas}{"/"}{.status.replicas}{"\n"}{end}' 2>/dev/null || true)
if [[ -n "$DEPLOYMENTS" ]]; then
  echo "$DEPLOYMENTS" | while read -r name ready; do
    if [[ "$ready" == *"/"* ]]; then
      ready_num=$(echo "$ready" | cut -d'/' -f1)
      desired_num=$(echo "$ready" | cut -d'/' -f2)
      if [[ "$ready_num" == "$desired_num" ]]; then
        check_pass "Deployment $name: $ready"
      else
        check_fail "Deployment $name: $ready (not ready)"
      fi
    fi
  done
else
  check_fail "No deployments found"
fi

# --- Check 3: Services have endpoints ---
log_bold ""
log_bold "[3/6] Service Endpoints"
SERVICES=$(kubectl get services -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
for svc in $SERVICES; do
  ENDPOINTS=$(kubectl get endpoints "$svc" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || true)
  if [[ -n "$ENDPOINTS" ]]; then
    check_pass "Service $svc has endpoints"
  else
    check_fail "Service $svc has NO endpoints"
  fi
done

# --- Check 4: Ingress has address ---
log_bold ""
log_bold "[4/6] Ingress Status"
INGRESSES=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
for ing in $INGRESSES; do
  ADDRESS=$(kubectl get ingress "$ing" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  if [[ -n "$ADDRESS" ]]; then
    check_pass "Ingress $ing has address: $ADDRESS"
  else
    check_fail "Ingress $ing has NO address assigned"
  fi
done

# --- Check 5: API health check ---
log_bold ""
log_bold "[5/6] API Health Check"
API_POD=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "$API_POD" ]]; then
  HEALTH=$(kubectl exec "$API_POD" -n "$NAMESPACE" -- wget -qO- --timeout=5 http://localhost:3001/api/health 2>/dev/null || true)
  if [[ "$HEALTH" == *"ok"* ]] || [[ "$HEALTH" == *"healthy"* ]]; then
    check_pass "API health check passed"
  else
    check_fail "API health check failed (response: $HEALTH)"
  fi
else
  check_fail "API pod not found"
fi

# --- Check 6: HPA status ---
log_bold ""
log_bold "[6/6] HPA Status"
HPAS=$(kubectl get hpa -n "$NAMESPACE" --no-headers 2>/dev/null || true)
if [[ -n "$HPAS" ]]; then
  echo "$HPAS" | while read -r line; do
    name=$(echo "$line" | awk '{print $1}')
    current=$(echo "$line" | awk '{print $3}')
    desired=$(echo "$line" | awk '{print $4}')
    if [[ "$current" == "$desired" ]]; then
      check_pass "HPA $name: $current/$desired"
    else
      check_warn "HPA $name: $current/$desired (scaling)"
    fi
  done
else
  log_info "No HPA resources found (may be disabled)"
fi

# --- Summary ---
log_bold ""
log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  Verification Summary"
log_bold "═══════════════════════════════════════════════════════════════"
log_info "Passed : $PASS"
log_info "Failed : $FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  log_error "Verification FAILED ($FAIL issues found)"
  exit 1
else
  log_ok "Verification PASSED — all systems operational"
  exit 0
fi
