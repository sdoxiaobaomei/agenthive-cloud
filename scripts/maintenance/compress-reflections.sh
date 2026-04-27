#!/bin/bash
# AgentHive Cloud — Compress Reflections (Bash version)
# 将 .kimi/memory/reflections/ 下的旧 reflection 压缩为月度摘要。

set -e

MONTH="${1:-$(date -d 'last month' +%Y-%m)}"
MEMORY_ROOT="${2:-.kimi/memory}"
WHATIF="${3:-}"

REFLECTION_DIR="$MEMORY_ROOT/reflections"
ARCHIVE_DIR="$MEMORY_ROOT/archive/reflections/$MONTH"
SUMMARY_FILE="$REFLECTION_DIR/summary-$MONTH.md"

echo "========================================"
echo "Reflection Compression: $MONTH"
echo "========================================"

# 收集该月的 reflection 文件
readarray -t FILES < <(find "$REFLECTION_DIR" -maxdepth 1 -name "*.md" -newermt "$MONTH-01" ! -newermt "$MONTH-01 +1 month" 2>/dev/null)

if [ ${#FILES[@]} -eq 0 ]; then
    echo "No reflections found for $MONTH. Nothing to do."
    exit 0
fi

echo "Found ${#FILES[@]} reflections to compress."

# 合并内容
TEMP_FILE=$(mktemp)
for f in "${FILES[@]}"; do
    echo ""
    echo "--- $(basename "$f") ---"
    echo ""
    cat "$f"
done > "$TEMP_FILE"

TEMP_SIZE_KB=$(du -k "$TEMP_FILE" | cut -f1)
echo "Combined into temp file: $TEMP_FILE (${TEMP_SIZE_KB}KB)"

# 生成摘要（如果 kimi 可用）
if command -v kimi &> /dev/null; then
    echo "Running Kimi CLI to generate summary..."
    PROMPT="你是一位技术文档整理专家。请将以下 $MONTH 月的 Agent 任务反思记录压缩为一份结构化月度摘要。

要求：
1. High-Frequency Patterns: 出现 3+ 次的模式
2. One-Time Insights: 仅出现 1 次但有价值的洞察
3. Mistakes to Avoid: 需要避免的错误
4. Skill Additions: 建议沉淀为新技能的条目（含文件路径）
5. 每条目 1-2 句话，不要展开细节

输出格式为 Markdown，标题: \"# Reflection Summary: $MONTH\""

    if [ -z "$WHATIF" ]; then
        if kimi "$PROMPT" --file "$TEMP_FILE" > "$SUMMARY_FILE" 2>/dev/null; then
            echo "Summary written: $SUMMARY_FILE"
        else
            echo "Warning: Kimi CLI failed. Writing placeholder."
            {
                echo "# Reflection Summary: $MONTH"
                echo ""
                echo "> Generated on $(date '+%Y-%m-%d')"
                echo ""
                echo "## Files Compressed"
                for f in "${FILES[@]}"; do echo "- $(basename "$f")"; done
                echo ""
                echo "## Note"
                echo ""
                echo "请手动补充摘要内容。"
            } > "$SUMMARY_FILE"
        fi
    else
        echo "[WhatIf] Would generate summary and write to: $SUMMARY_FILE"
    fi
else
    echo "Warning: Kimi CLI not found."
    {
        echo "# Reflection Summary: $MONTH"
        echo ""
        echo "> Generated on $(date '+%Y-%m-%d')"
        echo ""
        echo "## Files Compressed"
        for f in "${FILES[@]}"; do echo "- $(basename "$f")"; done
        echo ""
        echo "## Note"
        echo ""
        echo "Kimi CLI 未安装。请手动补充摘要内容。"
    } > "$SUMMARY_FILE"
fi

# 归档原始文件
if [ -z "$WHATIF" ]; then
    mkdir -p "$ARCHIVE_DIR"
    for f in "${FILES[@]}"; do
        mv "$f" "$ARCHIVE_DIR/"
    done
    echo "Archived ${#FILES[@]} files to: $ARCHIVE_DIR"
else
    echo "[WhatIf] Would archive ${#FILES[@]} files to: $ARCHIVE_DIR"
fi

# 清理临时文件
rm -f "$TEMP_FILE"

echo "========================================"
echo "Compression complete."
