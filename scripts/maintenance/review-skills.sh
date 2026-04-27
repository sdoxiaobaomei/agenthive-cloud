#!/bin/bash
# AgentHive Cloud — Review Skills (Bash version)
# 审查 .kimi/memory/skills/ 下的所有技能，决定晋升/降级/淘汰。

set -e

MEMORY_ROOT="${1:-.kimi/memory}"
WHATIF="${2:-}"

ROLES=("java" "node" "frontend" "platform")
NOW=$(date +%s)
REPORT=""

echo "========================================"
echo "Skill Review Report"
echo "Date: $(date '+%Y-%m-%d')"
echo "========================================"

for role in "${ROLES[@]}"; do
    echo ""
    echo "--- Role: $role ---"

    SKILL_BASE="$MEMORY_ROOT/skills/$role"
    [ -d "$SKILL_BASE" ] || continue

    # 检查 draft/ 中过期文件
    if [ -d "$SKILL_BASE/draft" ]; then
        while IFS= read -r -d '' f; do
            MTIME=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f")
            AGE_DAYS=$(( (NOW - MTIME) / 86400 ))
            if [ "$AGE_DAYS" -gt 30 ]; then
                REPORT="${REPORT}DELETE|$role|$f|Draft expired ($AGE_DAYS days)\n"
                echo "  [DELETE] $(basename "$f") — Draft expired ($AGE_DAYS days)"
            fi
        done < <(find "$SKILL_BASE/draft" -name "*.md" -print0 2>/dev/null)
    fi

    # 检查 official/ 中冷门文件
    if [ -d "$SKILL_BASE/official" ]; then
        while IFS= read -r -d '' f; do
            SKILL_NAME=$(basename "$f" .md)
            REFERENCES=0
            [ -d "$MEMORY_ROOT/reflections" ] && REFERENCES=$((REFERENCES + $(grep -rl "$SKILL_NAME" "$MEMORY_ROOT/reflections" 2>/dev/null | wc -l)))
            [ -d "$MEMORY_ROOT/episodes" ] && REFERENCES=$((REFERENCES + $(grep -rl "$SKILL_NAME" "$MEMORY_ROOT/episodes" 2>/dev/null | wc -l)))

            MTIME=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f")
            AGE_DAYS=$(( (NOW - MTIME) / 86400 ))

            if [ "$AGE_DAYS" -gt 90 ] && [ "$REFERENCES" -eq 0 ]; then
                REPORT="${REPORT}DEMOTE|$role|$f|No references in $AGE_DAYS days\n"
                echo "  [DEMOTE] $(basename "$f") — No references in $AGE_DAYS days"
            fi
        done < <(find "$SKILL_BASE/official" -name "*.md" -print0 2>/dev/null)
    fi

    # 检查 retired/ 中可删除文件
    if [ -d "$SKILL_BASE/retired" ]; then
        while IFS= read -r -d '' f; do
            MTIME=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f")
            AGE_DAYS=$(( (NOW - MTIME) / 86400 ))
            if [ "$AGE_DAYS" -gt 180 ]; then
                REPORT="${REPORT}DELETE|$role|$f|Retired expired ($AGE_DAYS days)\n"
                echo "  [DELETE] $(basename "$f") — Retired expired ($AGE_DAYS days)"
            fi
        done < <(find "$SKILL_BASE/retired" -name "*.md" -print0 2>/dev/null)
    fi
done

# 输出报告
echo ""
echo "========================================"
echo "Review Summary"
echo "========================================"

if [ -z "$REPORT" ]; then
    echo "All skills are healthy. No action needed."
else
    COUNT=$(echo -e "$REPORT" | grep -c "^" || true)
    echo "Found $COUNT items requiring attention:"
    echo ""
    echo -e "ACTION|ROLE|FILE|REASON"
    echo -e "$REPORT" | while IFS='|' read -r action role file reason; do
        echo "  [$action] [$role] $(basename "$file") — $reason"
    done

    if [ -z "$WHATIF" ]; then
        echo ""
        read -p "Apply changes? This will move/delete files. (y/N) " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo -e "$REPORT" | while IFS='|' read -r action role file reason; do
                case "$action" in
                    DELETE)
                        rm -f "$file"
                        echo "  Deleted: $file"
                        ;;
                    DEMOTE)
                        DEST_DIR=$(dirname "$file" | sed 's/official/draft/')
                        mkdir -p "$DEST_DIR"
                        mv "$file" "$DEST_DIR/"
                        echo "  Demoted: $file → $DEST_DIR/"
                        ;;
                esac
            done
            echo "Changes applied."
        else
            echo "Aborted. No changes made."
        fi
    else
        echo "[WhatIf] No changes applied."
    fi
fi
