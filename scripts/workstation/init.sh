#!/bin/bash
# init.sh - Agent Workstation Initialization Script
# Based on Anthropic "Effective harnesses for long-running agents"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AGENT_NAME=$1
PROJECT_ROOT=$(pwd)
WORKSTATION_DIR="WORKSTATIONS/${AGENT_NAME}-ws"
AGENT_DIR="AGENTS/${AGENT_NAME}"

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Agent Workstation Initialization"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Validate input
if [ -z "$AGENT_NAME" ]; then
    echo -e "${RED}❌ Error: Agent name is required${NC}"
    echo "Usage: ./init.sh <agent-name>"
    echo "Example: ./init.sh backend-dev"
    exit 1
fi

# Check if agent exists
if [ ! -d "$AGENT_DIR" ]; then
    echo -e "${RED}❌ Error: Agent '$AGENT_NAME' does not exist${NC}"
    echo "Available agents:"
    ls -1 AGENTS/ | grep -v "\.md$" | grep -v "TEMPLATES" | grep -v "reflection"
    exit 1
fi

echo "📋 Agent: $AGENT_NAME"
echo "📁 Workstation: $WORKSTATION_DIR"
echo ""

# Step 1: Create workstation directory structure
echo "🗂️  Step 1: Creating workstation directory structure..."
mkdir -p "$WORKSTATION_DIR"/{workspace,logs,temp,config}
echo -e "${GREEN}✓ Created: $WORKSTATION_DIR/{workspace,logs,temp,config}${NC}"

# Step 2: Clone project repository
echo ""
echo "📦 Step 2: Cloning project repository..."
if [ ! -d "$WORKSTATION_DIR/workspace/ai-digital-twin" ]; then
    git clone git@github.com:wutianchen/ai-digital-twin.git "$WORKSTATION_DIR/workspace/ai-digital-twin" 2>/dev/null || \
    git clone https://github.com/wutianchen/ai-digital-twin.git "$WORKSTATION_DIR/workspace/ai-digital-twin"
    echo -e "${GREEN}✓ Repository cloned${NC}"
else
    echo -e "${YELLOW}⚠ Repository already exists, pulling latest changes...${NC}"
    cd "$WORKSTATION_DIR/workspace/ai-digital-twin"
    git pull origin develop
    cd "$PROJECT_ROOT"
fi

# Step 3: Setup Git configuration
echo ""
echo "⚙️  Step 3: Setting up Git configuration..."
cd "$WORKSTATION_DIR/workspace/ai-digital-twin"
git config user.name "$AGENT_NAME"
git config user.email "$AGENT_NAME@ai-digital-twin.local"
git checkout develop 2>/dev/null || git checkout -b develop
echo -e "${GREEN}✓ Git configured for $AGENT_NAME${NC}"

# Step 4: Create environment file from template
echo ""
echo "🔧 Step 4: Setting up environment files..."
if [ -f ".env.example" ]; then
    cp .env.example "$WORKSTATION_DIR/config/.env.local"
    echo -e "${GREEN}✓ Created .env.local${NC}"
fi

# Step 5: Initialize Agent files if not exist
echo ""
echo "📝 Step 5: Initializing Agent files..."
cd "$PROJECT_ROOT"

# Create feature-list.json if not exists
if [ ! -f "$AGENT_DIR/duty/feature-list.json" ]; then
    cp AGENTS/TEMPLATES/feature-list-template.json "$AGENT_DIR/duty/feature-list.json"
    # Replace placeholders
    sed -i "s/{agent-name}/$AGENT_NAME/g" "$AGENT_DIR/duty/feature-list.json"
    sed -i "s/{date}/$(date +%Y-%m-%d)/g" "$AGENT_DIR/duty/feature-list.json"
    sed -i "s/{sprint-name}/Sprint-1/g" "$AGENT_DIR/duty/feature-list.json"
    echo -e "${GREEN}✓ Created feature-list.json${NC}"
fi

# Create session-progress.md if not exists
if [ ! -f "$AGENT_DIR/memory/session-progress.md" ]; then
    cp AGENTS/TEMPLATES/session-progress-template.md "$AGENT_DIR/memory/session-progress.md"
    sed -i "s/{Agent Name}/$AGENT_NAME/g" "$AGENT_DIR/memory/session-progress.md"
    echo -e "${GREEN}✓ Created session-progress.md${NC}"
fi

# Create handoffs directory
mkdir -p "$AGENT_DIR/handoffs"

# Step 6: Run health check
echo ""
echo "🏥 Step 6: Running health check..."
cd "$WORKSTATION_DIR/workspace/ai-digital-twin"
"$PROJECT_ROOT/scripts/health-check/basic.sh" || echo -e "${YELLOW}⚠ Health check completed with warnings${NC}"

# Step 7: Record initialization
echo ""
echo "📊 Step 7: Recording initialization..."
cat >> "$AGENT_DIR/memory/session-progress.md" << EOF

## Workstation Initialization
- **Date**: $(date '+%Y-%m-%d %H:%M:%S')
- **Status**: ✅ Completed
- **Location**: $WORKSTATION_DIR
- **Git Branch**: develop

## Ready to Start
1. cd $WORKSTATION_DIR/workspace/ai-digital-twin
2. Check feature-list.json for available tasks
3. Follow SESSION_STARTUP.md guidelines

EOF

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Workstation initialization completed!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. cd $WORKSTATION_DIR/workspace/ai-digital-twin"
echo "  2. cat $AGENT_DIR/duty/feature-list.json"
echo "  3. cat AGENTS/SESSION_STARTUP.md"
echo ""
