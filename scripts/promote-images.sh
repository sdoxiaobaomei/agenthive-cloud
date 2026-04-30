#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Image Promotion Script
# TICKET: PLATFORM-021-optimization
# Purpose: Promote locally-tested images to production registry with unified tag
# Usage  : bash scripts/promote-images.sh --tag v1.2.3-gabc1234 [--registry REGISTRY]
# =============================================================================

set -euo pipefail

TAG=""
REGISTRY="${REGISTRY:-crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com}"
NAMESPACE="agenthive"
DRY_RUN=false

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
    --tag)
      TAG="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      echo "Usage: bash scripts/promote-images.sh --tag v1.2.3-gabc1234 [--registry REGISTRY]"
      echo ""
      echo "Services promoted: api, landing, gateway-service, auth-service, user-service,"
      echo "                   payment-service, order-service, cart-service, logistics-service"
      exit 0
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$TAG" ]]; then
  log_error "--tag is required. Use git sha or semantic version."
  exit 1
fi

# --- Services to promote ---
SERVICES=(
  "agenthive/api"
  "agenthive/landing"
  "agenthive/gateway-service"
  "agenthive/auth-service"
  "agenthive/user-service"
  "agenthive/payment-service"
  "agenthive/order-service"
  "agenthive/cart-service"
  "agenthive/logistics-service"
)

log_info "Starting image promotion..."
log_info "Registry: $REGISTRY"
log_info "Tag:      $TAG"
echo ""

# --- Promote each image ---
for svc in "${SERVICES[@]}"; do
  LOCAL_IMAGE="$svc:latest"
  REMOTE_IMAGE="$REGISTRY/$svc:$TAG"
  
  # Check if local image exists
  if ! docker image inspect "$LOCAL_IMAGE" &>/dev/null; then
    log_warn "Local image $LOCAL_IMAGE not found. Skipping..."
    continue
  fi
  
  log_info "Promoting $svc ..."
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [DRY RUN] docker tag $LOCAL_IMAGE $REMOTE_IMAGE"
    echo "  [DRY RUN] docker push $REMOTE_IMAGE"
  else
    docker tag "$LOCAL_IMAGE" "$REMOTE_IMAGE"
    docker push "$REMOTE_IMAGE"
    log_ok "  $REMOTE_IMAGE pushed"
  fi
done

echo ""
log_ok "Promotion complete!"
log_info "All services now share unified tag: $TAG"
log_info "Next steps:"
log_info "  1. Update prod values:  sed -i 's/tag: .*/tag: \"$TAG\"/' k8s/overlays/production/kustomization.yaml"
log_info "  2. Deploy to prod:      kubectl apply -k k8s/overlays/production/"
log_info "  3. Verify rollout:      kubectl rollout status deployment/api -n agenthive"
