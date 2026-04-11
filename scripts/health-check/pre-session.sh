#!/bin/bash
# Pre-Session Health Check
# Run this before starting a new session

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Pre-Session Health Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Check current directory
echo "1️⃣  Working Directory"
echo "   $(pwd)"
echo ""

# 2. Check Git status
echo "2️⃣  Git Status"
BRANCH=$(git branch --show-current 2>/dev/null || echo "not a git repo")
echo "   Branch: $BRANCH"

if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "   ${YELLOW}⚠️  Uncommitted changes:${NC}"
    git status --short | head -5 | sed 's/^/   /'
fi
echo ""

# 3. Check last commits
echo "3️⃣  Recent Commits"
git log --oneline -5 | sed 's/^/   /'
echo ""

# 4. Check feature list status
echo "4️⃣  Feature List Status"
AGENT_NAME=$(pwd | grep -oP 'WORKSTATIONS/\K[^/]+' | sed 's/-ws$//')
if [ -n "$AGENT_NAME" ] && [ -f "../../AGENTS/$AGENT_NAME/duty/feature-list.json" ]; then
    echo "   Agent: $AGENT_NAME"
    # Count features by status
    PENDING=$(grep -c '"status": "pending"' "../../AGENTS/$AGENT_NAME/duty/feature-list.json" 2>/dev/null || echo 0)
    IN_PROGRESS=$(grep -c '"status": "in_progress"' "../../AGENTS/$AGENT_NAME/duty/feature-list.json" 2>/dev/null || echo 0)
    COMPLETED=$(grep -c '"status": "completed"' "../../AGENTS/$AGENT_NAME/duty/feature-list.json" 2>/dev/null || echo 0)
    echo "   Pending: $PENDING | In Progress: $IN_PROGRESS | Completed: $COMPLETED"
else
    echo "   ℹ️  No feature list found"
fi
echo ""

# 5. Environment check
echo "5️⃣  Environment"
if [ -f ".env.local" ]; then
    echo -e "   ${GREEN}✓ .env.local exists${NC}"
else
    echo -e "   ${YELLOW}⚠️  .env.local not found${NC}"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Pre-session check completed${NC}"
echo ""
echo "Ready to start session. Check feature-list.json for available tasks."
