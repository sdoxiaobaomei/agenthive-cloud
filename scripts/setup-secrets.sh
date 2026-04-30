#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — FREE Secret Setup Script
# TICKET: PLATFORM-021-optimization
# Purpose: Create K8s Secrets from .env file (zero-cost, no KMS required)
# Usage  : bash scripts/setup-secrets.sh [--from-env .env] [--namespace agenthive]
# =============================================================================

set -euo pipefail

NAMESPACE="agenthive"
SECRET_NAME="app-secrets"
ENV_FILE=".env"

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
while [[ $# -gt 0 ]]; do
  case $1 in
    --from-env)
      ENV_FILE="$2"
      shift 2
      ;;
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --help)
      echo "Usage: bash scripts/setup-secrets.sh [--from-env .env] [--namespace agenthive]"
      exit 0
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# --- Prerequisites ---
if ! command -v kubectl &>/dev/null; then
  log_error "kubectl not found. Install kubectl first."
  exit 1
fi

# --- Check namespace ---
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
  log_info "Creating namespace $NAMESPACE..."
  kubectl create namespace "$NAMESPACE"
fi

# --- Load from .env or interactive ---
if [[ -f "$ENV_FILE" ]]; then
  log_info "Loading secrets from $ENV_FILE..."
  
  # Export vars from .env
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
else
  log_warn "$ENV_FILE not found. Falling back to interactive mode..."
  read -rp "DB_PASSWORD: " DB_PASSWORD
  read -rp "JWT_SECRET: " JWT_SECRET
  read -rp "LLM_API_KEY: " LLM_API_KEY
  read -rp "BACKUP_ENCRYPTION_KEY: " BACKUP_ENCRYPTION_KEY
  read -rp "MINIO_ACCESS_KEY (optional): " MINIO_ACCESS_KEY
  read -rp "MINIO_SECRET_KEY (optional): " MINIO_SECRET_KEY
  read -rp "NACOS_AUTH_TOKEN (optional): " NACOS_AUTH_TOKEN
  read -rp "NACOS_PASSWORD (optional): " NACOS_PASSWORD
fi

# --- Validate required secrets ---
REQUIRED=("DB_PASSWORD" "JWT_SECRET" "LLM_API_KEY")
for key in "${REQUIRED[@]}"; do
  val="${!key:-}"
  if [[ -z "$val" || "$val" == "REPLACE_ME" ]]; then
    log_error "Required secret $key is missing or is placeholder. Check your $ENV_FILE"
    exit 1
  fi
done

# --- Create Secret ---
log_info "Creating Secret/$SECRET_NAME in namespace $NAMESPACE..."

kubectl create secret generic "$SECRET_NAME" \
  --namespace "$NAMESPACE" \
  --from-literal=DB_USER="${DB_USER:-agenthive}" \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD:-agenthive}" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=LLM_API_KEY="$LLM_API_KEY" \
  --from-literal=BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}" \
  --from-literal=MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-}" \
  --from-literal=MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-}" \
  --from-literal=NACOS_AUTH_TOKEN="${NACOS_AUTH_TOKEN:-}" \
  --from-literal=NACOS_PASSWORD="${NACOS_PASSWORD:-}" \
  --from-literal=RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-}" \
  --from-literal=INTERNAL_API_TOKEN="${INTERNAL_API_TOKEN:-}" \
  --from-literal=WITHDRAWAL_ENCRYPT_KEY="${WITHDRAWAL_ENCRYPT_KEY:-}" \
  --from-literal=GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-admin}" \
  --dry-run=client -o yaml | kubectl apply -f -

log_ok "Secret $SECRET_NAME created/updated successfully!"

# --- Verify ---
log_info "Verifying secret keys..."
kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data}' | \
  python3 -m json.tool 2>/dev/null || true

echo ""
log_ok "Setup complete!"
log_info "Next steps:"
log_info "  1. Deploy AgentHive: kubectl apply -k k8s/overlays/local/"
log_info "  2. Verify pods:      kubectl get pods -n $NAMESPACE"
log_info "  3. Rotate secrets:   bash scripts/security/rotate-secrets.sh"
