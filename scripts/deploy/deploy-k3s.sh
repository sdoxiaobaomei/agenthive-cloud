#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Manual K3s Deploy Script
# TICKET: PLATFORM-010
# Purpose: Local/scripted deployment to K3s with health checks
# Usage  : bash scripts/deploy-k3s.sh [OPTIONS]
# =============================================================================

set -euo pipefail

# --- Defaults ---
NAMESPACE="agenthive"
CHART_PATH="chart/agenthive"
VALUES_FILE="chart/agenthive/values.prod.yaml"
RELEASE_NAME="agenthive"
TIMEOUT="10m"
DRY_RUN=false
WAIT=true

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}ℹ️  ${NC} $1"; }
log_ok()    { echo -e "${GREEN}✅ ${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠️  ${NC} $1"; }
log_error() { echo -e "${RED}❌ ${NC} $1"; }
log_bold()  { echo -e "${BOLD}$1${NC}"; }

# --- Usage ---
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  -n, --namespace NAMESPACE   K8s namespace (default: agenthive)
  -c, --chart PATH            Helm chart path (default: chart/agenthive)
  -f, --values FILE           Values file (default: chart/agenthive/values.prod.yaml)
  -r, --release NAME          Helm release name (default: agenthive)
  -t, --timeout DURATION      Helm timeout (default: 10m)
  --dry-run                   Render templates only, do not deploy
  --no-wait                   Do not wait for rollout to complete
  -h, --help                  Show this help message

Examples:
  $(basename "$0") --dry-run                          # Preview changes
  $(basename "$0") -n agenthive-staging               # Deploy to staging
  $(basename "$0") -f values.staging.yaml --no-wait   # Quick deploy
EOF
  exit 0
}

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--namespace)    NAMESPACE="$2"; shift 2 ;;
    -c|--chart)        CHART_PATH="$2"; shift 2 ;;
    -f|--values)       VALUES_FILE="$2"; shift 2 ;;
    -r|--release)      RELEASE_NAME="$2"; shift 2 ;;
    -t|--timeout)      TIMEOUT="$2"; shift 2 ;;
    --dry-run)         DRY_RUN=true; shift ;;
    --no-wait)         WAIT=false; shift ;;
    -h|--help)         usage ;;
    *)                 log_error "Unknown option: $1"; usage ;;
  esac
done

# --- Prerequisites ---
if ! command -v helm &>/dev/null; then
  log_error "helm not found. Install Helm first: https://helm.sh/docs/intro/install/"
  exit 1
fi

if ! command -v kubectl &>/dev/null; then
  log_error "kubectl not found. Install kubectl first."
  exit 1
fi

log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  AgentHive Cloud — K3s Deployment"
log_bold "═══════════════════════════════════════════════════════════════"
log_info "Namespace : $NAMESPACE"
log_info "Chart     : $CHART_PATH"
log_info "Values    : $VALUES_FILE"
log_info "Release   : $RELEASE_NAME"
log_info "Timeout   : $TIMEOUT"
log_info "Dry Run   : $DRY_RUN"
log_info "Wait      : $WAIT"

# --- Dry Run ---
if [[ "$DRY_RUN" == "true" ]]; then
  log_info "Rendering templates (dry run)..."
  helm template "$RELEASE_NAME" "$CHART_PATH" \
    -f "$VALUES_FILE" \
    -n "$NAMESPACE"
  log_ok "Dry run complete."
  exit 0
fi

# --- Deploy ---
log_info "Deploying to K3s..."
helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" \
  -f "$VALUES_FILE" \
  -n "$NAMESPACE" \
  --create-namespace \
  --atomic \
  --timeout "$TIMEOUT" \
  --wait \
  --cleanup-on-fail

log_ok "Helm upgrade complete!"

# --- Wait for rollout ---
if [[ "$WAIT" == "true" ]]; then
  log_info "Waiting for rollout..."
  kubectl rollout status deployment/api -n "$NAMESPACE" --timeout=5m || true
  kubectl rollout status deployment/landing -n "$NAMESPACE" --timeout=5m || true
fi

# --- Health Check ---
log_info "Running health checks..."
bash "$(dirname "$0")/verify-deployment.sh" --namespace "$NAMESPACE"

log_bold ""
log_bold "═══════════════════════════════════════════════════════════════"
log_ok "  Deployment successful! 🎉"
log_bold "═══════════════════════════════════════════════════════════════"
log_info "Release : $RELEASE_NAME"
log_info "Namespace: $NAMESPACE"
log_info "Revision : $(helm history "$RELEASE_NAME" -n "$NAMESPACE" | tail -1 | awk '{print $1}')"
log_info "Status   : $(helm status "$RELEASE_NAME" -n "$NAMESPACE" | grep STATUS | awk '{print $2}')"
