#!/bin/bash
# Sync configuration to all active workstations

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔄 Syncing configuration to all workstations..."
echo ""

# Find all agent workstations
for workstation in WORKSTATIONS/*-ws; do
    if [ -d "$workstation" ]; then
        AGENT_NAME=$(basename "$workstation" | sed 's/-ws$//')
        echo "📦 Processing: $AGENT_NAME"
        
        # Sync shared config files
        if [ -f ".editorconfig" ]; then
            cp .editorconfig "$workstation/workspace/ai-digital-twin/" 2>/dev/null || true
        fi
        
        if [ -f ".gitignore" ]; then
            cp .gitignore "$workstation/workspace/ai-digital-twin/" 2>/dev/null || true
        fi
        
        echo -e "${GREEN}  ✓ Synced${NC}"
    fi
done

echo ""
echo -e "${GREEN}✅ Configuration sync completed${NC}"
