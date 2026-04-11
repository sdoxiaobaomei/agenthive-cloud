#!/bin/bash
# Cleanup workspaces - remove temp files and old build artifacts

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧹 Cleaning up workspaces..."
echo ""

# Cleanup each workstation
for workstation in WORKSTATIONS/*-ws; do
    if [ -d "$workstation" ]; then
        AGENT_NAME=$(basename "$workstation" | sed 's/-ws$//')
        echo "🗑️  Cleaning: $AGENT_NAME"
        
        # Clean temp directory
        if [ -d "$workstation/temp" ]; then
            rm -rf "$workstation/temp/*"
            echo "  ✓ Cleaned temp/"
        fi
        
        # Clean old logs (keep last 7 days)
        if [ -d "$workstation/logs" ]; then
            find "$workstation/logs" -type f -mtime +7 -delete 2>/dev/null || true
            echo "  ✓ Cleaned old logs"
        fi
        
        # Clean build artifacts in workspace
        if [ -d "$workstation/workspace/ai-digital-twin" ]; then
            cd "$workstation/workspace/ai-digital-twin"
            
            # Clean common build directories
            for dir in "node_modules/.cache" "dist" "build" "target/debug" "__pycache__"; do
                if [ -d "$dir" ]; then
                    rm -rf "$dir"
                    echo "  ✓ Cleaned $dir"
                fi
            done
            
            cd - > /dev/null
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ Cleanup completed${NC}"
