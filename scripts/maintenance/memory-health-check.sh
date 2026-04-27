#!/bin/bash
# AgentHive Cloud — Memory Health Check (Bash version)
# 检查 .kimi/memory/ 目录的健康状态，防止记忆膨胀。

set -e

MEMORY_ROOT="${1:-.kimi/memory}"
HAS_ERROR=0

metric() {
    local name="$1"
    local value="$2"
    local threshold="$3"
    local unit="${4:-}"
    if (( $(echo "$value > $threshold" | bc -l) )); then
        echo "[WARNING] $name: $value$unit (threshold: $threshold$unit)"
        HAS_ERROR=1
    else
        echo "[OK] $name: $value$unit (threshold: $threshold$unit)"
    fi
}

echo "============================================="
echo "AgentHive Cloud — Memory Health Check"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================="

# Metric 1: Reflections count
REFLECTION_COUNT=$(find "$MEMORY_ROOT/reflections" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)
metric "Reflections (active)" "$REFLECTION_COUNT" 30

# Metric 2: Skills per role
for role in java node frontend platform; do
    OFFICIAL_COUNT=$(find "$MEMORY_ROOT/skills/$role/official" -name "*.md" 2>/dev/null | wc -l)
    DRAFT_COUNT=$(find "$MEMORY_ROOT/skills/$role/draft" -name "*.md" 2>/dev/null | wc -l)
    metric "Skills [$role] official" "$OFFICIAL_COUNT" 50
    metric "Skills [$role] draft" "$DRAFT_COUNT" 10
done

# Metric 3: lessons-learned.md size
LL_PATH="$MEMORY_ROOT/shared/lessons-learned.md"
if [ -f "$LL_PATH" ]; then
    LL_SIZE_KB=$(du -k "$LL_PATH" | cut -f1)
    metric "lessons-learned.md size" "$LL_SIZE_KB" 10 "KB"
fi

# Metric 4: Archive size
ARCHIVE_KB=0
for ap in "$MEMORY_ROOT/archive" "$MEMORY_ROOT/reflections/archive"; do
    if [ -d "$ap" ]; then
        SIZE=$(du -sk "$ap" 2>/dev/null | cut -f1 || echo 0)
        ARCHIVE_KB=$((ARCHIVE_KB + SIZE))
    fi
done
metric "Archive total size" "$ARCHIVE_KB" 500 "KB"

# Metric 5: Episodes count
EPISODE_COUNT=$(find "$MEMORY_ROOT/episodes" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)
metric "Episodes (active)" "$EPISODE_COUNT" 20

echo ""
if [ "$HAS_ERROR" -eq 1 ]; then
    echo "Result: WARNING — Memory maintenance recommended"
    exit 1
else
    echo "Result: OK — Memory health is good"
    exit 0
fi
