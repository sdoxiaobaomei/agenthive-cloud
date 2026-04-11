#!/bin/bash
# Basic Health Check Script
# Validates the development environment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🏥 Running Basic Health Check..."
echo ""

ERRORS=0
WARNINGS=0

# Check 1: Git repository
echo "🔍 Check 1: Git repository..."
if [ -d ".git" ]; then
    BRANCH=$(git branch --show-current)
    echo -e "${GREEN}✓ Git repository OK (branch: $BRANCH)${NC}"
else
    echo -e "${RED}✗ Not a git repository${NC}"
    ((ERRORS++))
fi

# Check 2: Required directories
echo ""
echo "🔍 Check 2: Required directories..."
for dir in "docs" "AGENTS" "WORKSTATIONS"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓ Directory exists: $dir${NC}"
    else
        echo -e "${YELLOW}⚠ Directory missing: $dir${NC}"
        ((WARNINGS++))
    fi
done

# Check 3: Git status (check for uncommitted changes)
echo ""
echo "🔍 Check 3: Git status..."
if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✓ Working directory clean${NC}"
else
    echo -e "${YELLOW}⚠ Uncommitted changes detected${NC}"
    git status --short
    ((WARNINGS++))
fi

# Check 4: Essential files
echo ""
echo "🔍 Check 4: Essential files..."
for file in "README.md" "AGENTS/README.md" "AGENTS/SESSION_STARTUP.md"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ File exists: $file${NC}"
    else
        echo -e "${YELLOW}⚠ File missing: $file${NC}"
        ((WARNINGS++))
    fi
done

# Check 5: Disk space
echo ""
echo "🔍 Check 5: Disk space..."
DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓ Disk usage: ${DISK_USAGE}%${NC}"
else
    echo -e "${YELLOW}⚠ Disk usage high: ${DISK_USAGE}%${NC}"
    ((WARNINGS++))
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Health Check Summary"
echo "═══════════════════════════════════════════════════════════════"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Health check completed with warnings${NC}"
    exit 0
else
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi
