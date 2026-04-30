#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Git Secret Cleanup Script
# TICKET: PLATFORM-009
# Purpose: Remove sensitive values from Git history using BFG Repo-Cleaner
# Usage  : bash scripts/clean-git-secrets.sh [--dry-run]
# WARNING: This rewrites Git history. All team members must re-clone.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DRY_RUN=false
BFG_VERSION="1.14.0"
BFG_JAR="${PROJECT_ROOT}/.tmp/bfg-${BFG_VERSION}.jar"
ENV_FILE="${PROJECT_ROOT}/.env.prod"
REPLACEMENT_FILE="${PROJECT_ROOT}/.tmp/secrets-replacement.txt"

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
  --dry-run         Preview changes without rewriting history
  --help            Show this help message

Prerequisites:
  - Java 8+ installed
  - .env.prod exists with real values (will NOT be committed)
  - You have push access to the remote repository

WARNING:
  This script REWRITES Git history. All team members must:
    1. Save any uncommitted work
    2. Delete their local clone
    3. Re-clone the repository after you push

Process:
  1. Download BFG Repo-Cleaner (if not present)
  2. Generate replacement rules from .env.prod
  3. Run BFG to replace secrets in all commits
  4. Run git reflog expire + gc to clean dangling objects
  5. Force push to remote
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)   DRY_RUN=true; shift ;;
    --help|-h)   usage ;;
    *)           log_error "Unknown option: $1"; usage ;;
  esac
done

# =============================================================================
# Prerequisites Check
# =============================================================================
log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  Git Secret Cleanup"
log_bold "═══════════════════════════════════════════════════════════════"

cd "$PROJECT_ROOT"

if ! command -v java &>/dev/null; then
  log_error "Java not found. Install Java 8+ first."
  exit 1
fi

if ! git rev-parse --git-dir &>/dev/null; then
  log_error "Not a git repository."
  exit 1
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "unknown")
log_info "Repository: $REMOTE_URL"
log_info "Branch:     $(git branch --show-current)"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  log_error "You have uncommitted changes. Commit or stash them first."
  git status -s
  exit 1
fi

# =============================================================================
# Step 1: Download BFG
# =============================================================================
log_bold "Step 1/5 — Download BFG Repo-Cleaner"

mkdir -p "$(dirname "$BFG_JAR")"

if [[ ! -f "$BFG_JAR" ]]; then
  log_info "Downloading BFG v${BFG_JAR}..."
  curl -sL "https://repo1.maven.org/maven2/com/madgag/bfg/${BFG_VERSION}/bfg-${BFG_VERSION}.jar" \
    -o "$BFG_JAR"
  log_ok "BFG downloaded: $BFG_JAR"
else
  log_ok "BFG already present: $BFG_JAR"
fi

# =============================================================================
# Step 2: Generate replacement rules from .env.prod
# =============================================================================
log_bold "Step 2/5 — Generate replacement rules"

if [[ ! -f "$ENV_FILE" ]]; then
  log_error ".env.prod not found at $ENV_FILE"
  log_info "This script needs .env.prod to know what secrets to clean."
  exit 1
fi

mkdir -p "$(dirname "$REPLACEMENT_FILE")"

# Build replacement file
# Format: original_value==>REPLACEMENT_TAG
generate_replacements() {
  local env_file="$1"
  local out_file="$2"
  
  > "$out_file"
  
  # Helper: add replacement if value is non-empty and not a placeholder
  add_replacement() {
    local key="$1"
    local placeholder="$2"
    local value
    value=$(grep "^${key}=" "$env_file" | cut -d'=' -f2- | head -1)
    
    if [[ -n "$value" && "$value" != "REPLACE_ME" && "$value" != "<YOUR_"* && "$value" != "sk-your-"* && "$value" != "admin" && "$value" != "guest" && "$value" != "dev" && "$value" != "nacos" ]]; then
      echo "${value}==>${placeholder}" >> "$out_file"
      log_info "Will replace: $key → ${placeholder}"
    fi
  }
  
  # Database
  add_replacement "DB_PASSWORD" "<DB_PASSWORD>"
  
  # Redis
  add_replacement "REDIS_PASSWORD" "<REDIS_PASSWORD>"
  
  # JWT
  add_replacement "JWT_SECRET" "<JWT_SECRET>"
  
  # LLM
  add_replacement "LLM_API_KEY" "<LLM_API_KEY>"
  
  # Nacos
  add_replacement "NACOS_AUTH_TOKEN" "<NACOS_AUTH_TOKEN>"
  add_replacement "NACOS_PASSWORD" "<NACOS_PASSWORD>"
  add_replacement "NACOS_AUTH_IDENTITY_VALUE" "<NACOS_AUTH_IDENTITY_VALUE>"
  
  # RabbitMQ
  add_replacement "RABBITMQ_PASSWORD" "<RABBITMQ_PASSWORD>"
  
  # Aliyun
  add_replacement "ALIBABA_CLOUD_ACCESS_KEY_ID" "<ALIBABA_CLOUD_ACCESS_KEY_ID>"
  add_replacement "ALIBABA_CLOUD_ACCESS_KEY_SECRET" "<ALIBABA_CLOUD_ACCESS_KEY_SECRET>"
  
  # Grafana
  add_replacement "GRAFANA_PASSWORD" "<GRAFANA_PASSWORD>"
}

generate_replacements "$ENV_FILE" "$REPLACEMENT_FILE"

if [[ ! -s "$REPLACEMENT_FILE" ]]; then
  log_warn "No sensitive values found to replace."
  rm -f "$REPLACEMENT_FILE"
  exit 0
fi

REPLACEMENT_COUNT=$(wc -l < "$REPLACEMENT_FILE" | tr -d ' ')
log_ok "Generated ${REPLACEMENT_COUNT} replacement rules"

# Also handle .env.prod itself — remove from history
if git log --all --full-history -- .env.prod | grep -q commit; then
  log_warn ".env.prod found in Git history — will be removed"
fi

# =============================================================================
# Step 3: Run BFG
# =============================================================================
log_bold "Step 3/5 — Run BFG Repo-Cleaner"

if [[ "$DRY_RUN" == "true" ]]; then
  log_info "[DRY RUN] Would execute:"
  log_info "  java -jar bfg.jar --replace-text ${REPLACEMENT_FILE}"
  log_info "  java -jar bfg.jar --delete-files .env.prod"
  log_info "  git reflog expire --expire=now --all"
  log_info "  git gc --prune=now --aggressive"
  log_info "  git push --force"
  
  log_bold "Replacement rules preview:"
  cat "$REPLACEMENT_FILE"
  
  # Cleanup temp files
  rm -f "$REPLACEMENT_FILE"
  exit 0
fi

# Safety confirmation
log_warn "⚠️  This will REWRITE Git history for the entire repository!"
log_warn "⚠️  All team members must re-clone after you push!"
log_warn "⚠️  Make sure you have a backup of the remote repo!"
echo ""
read -rp "Type 'CLEANSE' to proceed: " confirm
if [[ "$confirm" != "CLEANSE" ]]; then
  log_info "Aborted. No changes made."
  rm -f "$REPLACEMENT_FILE"
  exit 0
fi

# Run BFG replace-text
log_info "Replacing secrets in all commits..."
java -jar "$BFG_JAR" --replace-text "$REPLACEMENT_FILE" "$PROJECT_ROOT"

# Remove .env.prod from history
log_info "Removing .env.prod from history..."
java -jar "$BFG_JAR" --delete-files .env.prod "$PROJECT_ROOT"

# =============================================================================
# Step 4: Clean up dangling objects
# =============================================================================
log_bold "Step 4/5 — Clean up dangling objects"

git reflog expire --expire=now --all
git gc --prune=now --aggressive

log_ok "Git repository cleaned"

# =============================================================================
# Step 5: Force push
# =============================================================================
log_bold "Step 5/5 — Force push"

log_warn "About to force push. This will rewrite remote history!"
read -rp "Force push to origin? (yes/no): " push_confirm

if [[ "$push_confirm" == "yes" ]]; then
  git push --force
  log_ok "Force push complete!"
else
  log_info "Push skipped. Run manually when ready:"
  log_info "  git push --force"
fi

# =============================================================================
# Cleanup
# =============================================================================
rm -f "$REPLACEMENT_FILE"
log_info "Temporary files cleaned"

# Update .gitignore
if ! grep -q "^\.env\.prod$" .gitignore 2>/dev/null; then
  echo ".env.prod" >> .gitignore
  log_ok "Added .env.prod to .gitignore"
fi

if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo ".env" >> .gitignore
  log_ok "Added .env to .gitignore"
fi

log_bold ""
log_bold "═══════════════════════════════════════════════════════════════"
log_bold "  Cleanup Complete"
log_bold "═══════════════════════════════════════════════════════════════"
log_info "Next steps:"
log_info "  1. Verify: git log --oneline | head -5"
log_info "  2. Verify: git log --all --full-history -- .env.prod (should be empty)"
log_info "  3. Team notification: Ask everyone to re-clone"
log_info "  4. Verify remote: curl -s ${REMOTE_URL} | grep -i secret (should be clean)"
log_info ""
log_warn "⚠️  Team members MUST re-clone:"
log_warn "   rm -rf agenthive-cloud/"
log_warn "   git clone ${REMOTE_URL}"
