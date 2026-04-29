#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Secret Rotation Script
# TICKET: PLATFORM-009
# Purpose: Rotate K8s secrets and update External Secrets references
# Usage  : bash scripts/rotate-secrets.sh [--dry-run]
# =============================================================================

set -euo pipefail

DRY_RUN=false
NAMESPACE="agenthive"
SECRET_NAME="app-secrets"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}ℹ️  ${NC} $1"; }
log_ok()    { echo -e "${GREEN}✅ ${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠️  ${NC} $1"; }
log_error() { echo -e "${RED}❌ ${NC} $1"; }

# --- Parse args ---
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      log_warn "DRY RUN mode — no changes will be applied"
      ;;
    *)
      log_error "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# --- Prerequisites ---
if ! command -v kubectl &>/dev/null; then
  log_error "kubectl not found. Install kubectl first."
  exit 1
fi

if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
  log_error "Namespace $NAMESPACE does not exist. Deploy AgentHive first."
  exit 1
fi

# --- Secrets to rotate ---
declare -A SECRETS=(
  [JWT_SECRET]="$(openssl rand -hex 32)"
  [DB_PASSWORD]=""
  [REDIS_PASSWORD]=""
  [LLM_API_KEY]=""
  [NACOS_AUTH_TOKEN]="$(openssl rand -hex 32)"
  [GRAFANA_ADMIN_PASSWORD]=""
)

# --- Generate new values ---
log_info "Generating new secret values..."
for key in "${!SECRETS[@]}"; do
  if [[ -z "${SECRETS[$key]}" ]]; then
    # For user-provided secrets, generate a placeholder and prompt
    SECRETS[$key]="$(openssl rand -base64 24)"
    log_warn "$key auto-generated. You MUST update this in your secret store (KMS/1Password)."
  fi
done

# --- Apply rotation ---
if [[ "$DRY_RUN" == "true" ]]; then
  log_info "[DRY RUN] Would patch Secret/$SECRET_NAME in namespace $NAMESPACE"
  for key in "${!SECRETS[@]}"; do
    echo "  $key: ${SECRETS[$key]:0:8}..."
  done
  exit 0
fi

log_info "Patching Secret/$SECRET_NAME..."

# Build JSON patch
PATCH="{\"stringData\":{"
FIRST=true
for key in "${!SECRETS[@]}"; do
  if [[ "$FIRST" == "true" ]]; then
    FIRST=false
  else
    PATCH+=","
  fi
  PATCH+="\"$key\":\"${SECRETS[$key]}\""
done
PATCH+="}}"

kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" --type=merge -p "$PATCH"

# --- Restart deployments to pick up new secrets ---
log_info "Rolling restart to pick up new secrets..."
kubectl rollout restart deployment -n "$NAMESPACE" -l app.kubernetes.io/part-of=agenthive

log_ok "Secret rotation complete!"
log_info "Next steps:"
log_info "  1. Update your secret store (KMS/1Password) with the new values"
log_info "  2. Verify pods are running: kubectl get pods -n $NAMESPACE"
log_info "  3. Check application health: kubectl get events -n $NAMESPACE"
