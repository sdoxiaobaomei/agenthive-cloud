#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Git Secret Scrubber
# TICKET: PLATFORM-009
# Purpose: Remove leaked secrets from Git history using BFG Repo-Cleaner
# WARNING: This rewrites Git history. ALL collaborators must re-clone.
# Usage  : bash scripts/clean-git-secrets.sh [--verify-only]
# =============================================================================

set -euo pipefail

VERIFY_ONLY=false
BFG_JAR="bfg-1.14.0.jar"
BFG_URL="https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"

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

# --- Parse args ---
for arg in "$@"; do
  case $arg in
    --verify-only)
      VERIFY_ONLY=true
      ;;
    *)
      log_error "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# --- Verify phase ---
log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  Secret History Verification"
log_bold "═══════════════════════════════════════════════════════════════"

PATTERNS=(
  "sk-kimi-[A-Za-z0-9]{20,}"
  "DB_PASSWORD=[^#].{8,}"
  "REDIS_PASSWORD=[^#].{8,}"
  "JWT_SECRET=[^#].{32,}"
  "LLM_API_KEY=[^#].{20,}"
  "NACOS_AUTH_TOKEN=[^#].{20,}"
)

FOUND=false
for pattern in "${PATTERNS[@]}"; do
  log_info "Scanning for pattern: $pattern"
  if git log --all --source --remotes --patch -S "$pattern" --pickaxe-regex -- '.env*' 2>/dev/null | head -20; then
    log_warn "POTENTIAL LEAK DETECTED: pattern '$pattern' found in history"
    FOUND=true
  else
    log_ok "No matches for: $pattern"
  fi
done

if [[ "$VERIFY_ONLY" == "true" ]]; then
  if [[ "$FOUND" == "true" ]]; then
    log_warn "Run without --verify-only to scrub history"
    exit 1
  else
    log_ok "No secrets detected in Git history"
    exit 0
  fi
fi

# --- Scrub phase ---
if [[ "$FOUND" == "false" ]]; then
  log_ok "No secrets detected. Nothing to scrub."
  exit 0
fi

log_bold ""
log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  ⚠️  HISTORY REWRITE WARNING"
log_bold "═══════════════════════════════════════════════════════════════"
log_warn "This will PERMANENTLY rewrite Git history."
log_warn "All collaborators must re-clone the repository after this."
log_warn "Ensure you have a backup of the repo (mirror clone)."
log_bold ""

read -p "Type 'REWRITE' to proceed: " CONFIRM
if [[ "$CONFIRM" != "REWRITE" ]]; then
  log_info "Aborted. No changes made."
  exit 0
fi

# --- Download BFG if needed ---
if [[ ! -f "$BFG_JAR" ]]; then
  log_info "Downloading BFG Repo-Cleaner..."
  curl -L -o "$BFG_JAR" "$BFG_URL"
  log_ok "Downloaded $BFG_JAR"
fi

# --- Create replacement rules ---
REPLACEMENTS_FILE="$(mktemp)"
cat > "$REPLACEMENTS_FILE" << 'EOF'
DB_PASSWORD=REPLACE_ME==>DB_PASSWORD=
REDIS_PASSWORD=REPLACE_ME==>REDIS_PASSWORD=
JWT_SECRET=REPLACE_ME==>JWT_SECRET=
LLM_API_KEY=REPLACE_ME==>LLM_API_KEY=
NACOS_AUTH_TOKEN=REPLACE_ME==>NACOS_AUTH_TOKEN=
EOF

# Run BFG
log_info "Running BFG Repo-Cleaner..."
java -jar "$BFG_JAR" --replace-text "$REPLACEMENTS_FILE" --no-blob-protection .

# Clean up
rm -f "$REPLACEMENTS_FILE"

log_info "Running git reflog expiry and garbage collection..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

log_ok "Git history scrubbed!"
log_warn "You MUST now force-push: git push --force --all"
log_warn "All collaborators must run: git clone <repo> fresh"
