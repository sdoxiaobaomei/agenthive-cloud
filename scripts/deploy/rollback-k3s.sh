#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — K3s Rollback Script
# TICKET: PLATFORM-010
# Purpose: Rollback Helm release to previous (or specified) revision
# Usage  : bash scripts/rollback-k3s.sh [OPTIONS]
# =============================================================================

set -euo pipefail

NAMESPACE="agenthive"
RELEASE_NAME="agenthive"
REVISION=""
DRY_RUN=false

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
  -n, --namespace NAMESPACE   K8s namespace (default: agenthive)
  -r, --release NAME          Helm release name (default: agenthive)
  --revision NUM              Rollback to specific revision (default: previous)
  --dry-run                   Preview rollback, do not execute
  -h, --help                  Show this help message

Examples:
  $(basename "$0")                        # Rollback to previous revision
  $(basename "$0") --revision 3           # Rollback to revision 3
  $(basename "$0") --dry-run              # Preview rollback
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--namespace)    NAMESPACE="$2"; shift 2 ;;
    -r|--release)      RELEASE_NAME="$2"; shift 2 ;;
    --revision)        REVISION="$2"; shift 2 ;;
    --dry-run)         DRY_RUN=true; shift ;;
    -h|--help)         usage ;;
    *)                 log_error "Unknown option: $1"; usage ;;
  esac
done

if ! command -v helm &>/dev/null; then
  log_error "helm not found."
  exit 1
fi

log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  AgentHive Cloud — Rollback"
log_bold "═══════════════════════════════════════════════════════════════"

# Show history
log_info "Release history:"
helm history "$RELEASE_NAME" -n "$NAMESPACE" | tail -10

# Determine target revision
if [[ -z "$REVISION" ]]; then
  CURRENT=$(helm history "$RELEASE_NAME" -n "$NAMESPACE" | tail -1 | awk '{print $1}')
  TARGET=$((CURRENT - 1))
else
  TARGET="$REVISION"
fi

log_warn "Will rollback to revision $TARGET"

if [[ "$DRY_RUN" == "true" ]]; then
  log_info "[DRY RUN] Would execute: helm rollback $RELEASE_NAME $TARGET -n $NAMESPACE"
  exit 0
fi

read -p "Confirm rollback to revision $TARGET? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  log_info "Aborted."
  exit 0
fi

helm rollback "$RELEASE_NAME" "$TARGET" -n "$NAMESPACE"

log_ok "Rollback complete!"
log_info "Verifying deployment..."
bash "$(dirname "$0")/verify-deployment.sh" --namespace "$NAMESPACE"

log_bold ""
log_ok "Rollback successful! Current revision:"
helm history "$RELEASE_NAME" -n "$NAMESPACE" | tail -3
