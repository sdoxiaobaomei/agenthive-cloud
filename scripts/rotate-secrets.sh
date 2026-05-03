#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Secret Rotation Script
# TICKET: PLATFORM-009
# Purpose: Rotate K8s Secrets with zero-downtime rollout and rollback support
# Usage  : bash scripts/rotate-secrets.sh [OPTIONS]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="agenthive"
SECRET_NAME="app-secrets"
DRY_RUN=false
ROTATE_ALL=false
SPECIFIC_KEYS=""
BACKUP_DIR="${SCRIPT_DIR}/../.secret-backups"
ROLLBACK=false
ROLLBACK_REVISION=""

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

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --all                       Rotate ALL secrets (full rotation)
  --keys KEY1,KEY2,...        Rotate only specific keys
  --namespace NAMESPACE       K8s namespace (default: agenthive)
  --dry-run                   Preview changes without applying
  --rollback REVISION         Rollback to a specific backup revision
  --list-backups              List available backup revisions
  -h, --help                  Show this help message

Examples:
  $(basename "$0") --all                              # Full rotation
  $(basename "$0") --keys DB_PASSWORD,REDIS_PASSWORD  # Partial rotation
  $(basename "$0") --dry-run --keys JWT_SECRET        # Dry run
  $(basename "$0") --rollback 20250430-143022         # Rollback
EOF
  exit 0
}

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --all)             ROTATE_ALL=true; shift ;;
    --keys)            SPECIFIC_KEYS="$2"; shift 2 ;;
    --namespace)       NAMESPACE="$2"; shift 2 ;;
    --dry-run)         DRY_RUN=true; shift ;;
    --rollback)        ROLLBACK=true; ROLLBACK_REVISION="$2"; shift 2 ;;
    --list-backups)    list_backups; exit 0 ;;
    -h|--help)         usage ;;
    *)                 log_error "Unknown option: $1"; usage ;;
  esac
done

# --- Prerequisites ---
if ! command -v kubectl &>/dev/null; then
  log_error "kubectl not found."
  exit 1
fi

if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
  log_error "Namespace $NAMESPACE not found."
  exit 1
fi

# --- Backup functions ---
backup_secret() {
  local backup_file="${BACKUP_DIR}/${SECRET_NAME}-${NAMESPACE}-$(date +%Y%m%d-%H%M%S).json"
  mkdir -p "$BACKUP_DIR"
  kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json > "$backup_file"
  chmod 600 "$backup_file"
  log_info "Backup created: $backup_file"
  echo "$backup_file"
}

list_backups() {
  log_bold "Available backups in $BACKUP_DIR:"
  if [[ ! -d "$BACKUP_DIR" ]]; then
    log_warn "No backup directory found."
    return
  fi
  ls -lt "$BACKUP_DIR"/*.json 2>/dev/null | while read -r line; do
    echo "  $line"
  done
}

rollback_secret() {
  local revision="$1"
  local backup_file
  
  if [[ -f "$revision" ]]; then
    backup_file="$revision"
  else
    backup_file=$(find "$BACKUP_DIR" -name "*${revision}*.json" | head -1)
  fi
  
  if [[ ! -f "$backup_file" ]]; then
    log_error "Backup not found: $revision"
    exit 1
  fi
  
  log_warn "Rolling back Secret from: $backup_file"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY RUN] Would restore Secret from $backup_file"
    return
  fi
  
  # Remove managed fields before applying
  jq 'del(.metadata.uid, .metadata.resourceVersion, .metadata.creationTimestamp, .metadata.selfLink, .metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"])' "$backup_file" | kubectl apply -f -
  
  log_ok "Rollback complete!"
  trigger_rollout
}

# --- Password generators ---
gen_password() {
  openssl rand -base64 32 | tr -d '=+/' | cut -c1-24
}

gen_jwt_secret() {
  openssl rand -base64 48
}

gen_nacos_token() {
  openssl rand -base64 48 | tr -d '=+/'
}

# --- Rotation logic ---
rotate_keys() {
  local keys="$1"
  local updates=()
  
  IFS=',' read -ra KEY_ARRAY <<< "$keys"
  for key in "${KEY_ARRAY[@]}"; do
    key=$(echo "$key" | xargs)  # trim
    case "$key" in
      DB_PASSWORD)
        updates+=("--from-literal=${key}=$(gen_password)")
        log_info "Rotating DB_PASSWORD"
        ;;
      REDIS_PASSWORD)
        updates+=("--from-literal=${key}=$(gen_password)")
        log_info "Rotating REDIS_PASSWORD"
        ;;
      JWT_SECRET)
        updates+=("--from-literal=${key}=$(gen_jwt_secret)")
        log_info "Rotating JWT_SECRET"
        ;;
      LLM_API_KEY)
        log_warn "LLM_API_KEY rotation requires manual update (external API key). Skipping..."
        ;;
      NACOS_AUTH_TOKEN)
        updates+=("--from-literal=${key}=$(gen_nacos_token)")
        log_info "Rotating NACOS_AUTH_TOKEN"
        ;;
      NACOS_PASSWORD)
        updates+=("--from-literal=${key}=$(gen_password)")
        log_info "Rotating NACOS_PASSWORD"
        ;;
      RABBITMQ_PASSWORD)
        updates+=("--from-literal=${key}=$(gen_password)")
        log_info "Rotating RABBITMQ_PASSWORD"
        ;;
      GRAFANA_ADMIN_PASSWORD)
        updates+=("--from-literal=${key}=$(gen_password)")
        log_info "Rotating GRAFANA_ADMIN_PASSWORD"
        ;;
      *)
        log_warn "Unknown key: $key (skipping)"
        ;;
    esac
  done
  
  echo "${updates[@]}"
}

# --- Trigger rollout ---
trigger_rollout() {
  log_bold "Triggering rolling restarts..."
  
  local deployments=(
    "api"
    "landing"
    "gateway-service"
    "auth-service"
    "payment-service"
    "order-service"
    "cart-service"
    "logistics-service"
  )
  
  for deploy in "${deployments[@]}"; do
    if kubectl get deployment "$deploy" -n "$NAMESPACE" &>/dev/null; then
      if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollout: $deploy"
      else
        kubectl rollout restart deployment "$deploy" -n "$NAMESPACE"
        log_ok "Rollout triggered: $deploy"
      fi
    fi
  done
}

# --- Wait for rollout ---
wait_for_rollout() {
  log_bold "Waiting for rollouts to complete..."
  
  local deployments=("api" "landing")
  for deploy in "${deployments[@]}"; do
    if kubectl get deployment "$deploy" -n "$NAMESPACE" &>/dev/null; then
      if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would wait for: $deploy"
      else
        if kubectl rollout status deployment "$deploy" -n "$NAMESPACE" --timeout=5m; then
          log_ok "Rollout complete: $deploy"
        else
          log_error "Rollout failed: $deploy"
          log_warn "Consider running: bash scripts/deploy/rollback-k3s.sh"
          exit 1
        fi
      fi
    fi
  done
}

# --- Verify health ---
verify_health() {
  log_bold "Verifying deployment health..."
  
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY RUN] Would run verify-deployment.sh"
    return
  fi
  
  if bash "${SCRIPT_DIR}/verify-deployment.sh" --namespace "$NAMESPACE" --timeout 180; then
    log_ok "Health check passed!"
  else
    log_error "Health check FAILED!"
    log_warn "Rolling back..."
    # Auto-rollback to last backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/*.json 2>/dev/null | head -1)
    if [[ -n "$latest_backup" ]]; then
      rollback_secret "$latest_backup"
    fi
    exit 1
  fi
}

# --- Main ---
main() {
  log_bold "═══════════════════════════════════════════════════════════════"
  log_bold "  AgentHive Cloud — Secret Rotation"
  log_bold "═══════════════════════════════════════════════════════════════"
  log_info "Namespace: $NAMESPACE"
  log_info "Secret:    $SECRET_NAME"
  log_info "Dry run:   $DRY_RUN"
  echo ""
  
  # Rollback mode
  if [[ "$ROLLBACK" == "true" ]]; then
    rollback_secret "$ROLLBACK_REVISION"
    exit 0
  fi
  
  # Check current secret exists
  if ! kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &>/dev/null; then
    log_error "Secret/$SECRET_NAME not found in namespace $NAMESPACE"
    log_info "Run: bash scripts/setup-secrets.sh --from-env .env.prod"
    exit 1
  fi
  
  # Determine keys to rotate
  if [[ "$ROTATE_ALL" == "true" ]]; then
    SPECIFIC_KEYS="DB_PASSWORD,REDIS_PASSWORD,JWT_SECRET,NACOS_AUTH_TOKEN,NACOS_PASSWORD,RABBITMQ_PASSWORD,GRAFANA_ADMIN_PASSWORD"
    log_warn "FULL ROTATION selected. This will rotate ALL secrets!"
    read -rp "Are you sure? Type 'rotate-all' to confirm: " confirm
    if [[ "$confirm" != "rotate-all" ]]; then
      log_info "Aborted."
      exit 0
    fi
  elif [[ -z "$SPECIFIC_KEYS" ]]; then
    log_error "No keys specified. Use --all or --keys KEY1,KEY2,..."
    usage
  fi
  
  # Create backup
  log_bold "Step 1/5 — Backup current Secret"
  local backup_file
  backup_file=$(backup_secret)
  
  # Generate new values
  log_bold "Step 2/5 — Generate new secrets"
  local updates
  updates=$(rotate_keys "$SPECIFIC_KEYS")
  
  if [[ -z "$updates" ]]; then
    log_warn "No secrets to rotate."
    exit 0
  fi
  
  # Apply updates
  log_bold "Step 3/5 — Update K8s Secret"
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY RUN] Would execute:"
    log_info "  kubectl patch secret $SECRET_NAME -n $NAMESPACE $updates"
  else
    # Reconstruct entire secret to avoid partial updates
    kubectl create secret generic "$SECRET_NAME" \
      --namespace="$NAMESPACE" \
      $updates \
      --dry-run=client -o yaml | kubectl apply -f -
    log_ok "Secret updated!"
  fi
  
  # Trigger rollout
  log_bold "Step 4/5 — Rolling restart"
  trigger_rollout
  wait_for_rollout
  
  # Verify
  log_bold "Step 5/5 — Health verification"
  verify_health
  
  # Summary
  log_bold ""
  log_bold "═══════════════════════════════════════════════════════════════"
  log_bold "  Rotation Summary"
  log_bold "═══════════════════════════════════════════════════════════════"
  log_ok "Rotation complete!"
  log_info "Backup: $backup_file"
  log_info "Rotated keys: ${SPECIFIC_KEYS}"
  log_info ""
  log_info "Next steps:"
  log_info "  1. Update .env.prod with new values (if needed for local dev)"
  log_info "  2. Monitor services: kubectl get pods -n $NAMESPACE -w"
  log_info "  3. To rollback: bash scripts/rotate-secrets.sh --rollback $(basename "$backup_file" .json)"
}

main "$@"
