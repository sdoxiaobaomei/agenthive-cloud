#!/bin/bash
# Sync Git commit to session-progress.md
# Usage: ./sync-progress.sh [agent-name]

AGENT_NAME=$1

# Auto-detect agent if not provided
if [ -z "$AGENT_NAME" ]; then
    # Try to get from git config
    AGENT_NAME=$(git config user.name)
    
    # If not set, try to get from directory
    if [ -z "$AGENT_NAME" ] || [ "$AGENT_NAME" = "root" ]; then
        AGENT_NAME=$(pwd | grep -oP 'WORKSTATIONS/\K[^/]+' | sed 's/-ws$//')
    fi
fi

if [ -z "$AGENT_NAME" ]; then
    echo "❌ Could not detect agent name"
    echo "Usage: ./sync-progress.sh <agent-name>"
    exit 1
fi

PROGRESS_FILE="AGENTS/$AGENT_NAME/memory/session-progress.md"

if [ ! -f "$PROGRESS_FILE" ]; then
    echo "❌ Progress file not found: $PROGRESS_FILE"
    exit 1
fi

# Get last commit info
COMMIT_HASH=$(git log -1 --pretty=%h)
COMMIT_MSG=$(git log -1 --pretty=%s)
COMMIT_DATE=$(git log -1 --pretty=%ci)

echo "📝 Syncing commit to progress file..."
echo "   Agent: $AGENT_NAME"
echo "   Commit: $COMMIT_HASH"
echo "   Message: $COMMIT_MSG"

# Append to progress file
cat >> "$PROGRESS_FILE" << EOF

## Commit Record
- **Time**: $COMMIT_DATE
- **Hash**: $COMMIT_HASH
- **Message**: $COMMIT_MSG

EOF

echo ""
echo "✅ Progress file updated"
