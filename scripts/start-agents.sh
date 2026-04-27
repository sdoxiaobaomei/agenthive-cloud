#!/usr/bin/env bash
# AgentHive Cloud — 多角色 Kimi Agent 一键启动脚本 (Linux/macOS)
# Usage:
#   ./start-agents.sh              # 启动全部
#   ./start-agents.sh java node    # 只启动 Java + Node
#   ./start-agents.sh --list       # 列出可用角色
#   ./start-agents.sh --wait       # 启动后等待按键（调试用）
#
# 修复记录 (2026-04-27):
# 1. 使用临时脚本文件传递命令，避免多层引号嵌套崩溃
# 2. 对路径中的空格和特殊字符进行转义保护
# 3. 移除 tmux 错误静默 (2>/dev/null || true)
# 4. 增加启动结果检测和错误提示
# 5. 增加 --wait 调试参数

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="$PROJECT_ROOT/.kimi/agents"
WAIT_AFTER_START=false

# 角色配置
NAMES=(lead java node frontend platform)
TITLES=("AgentHive Lead" "Java Backend" "Node Backend" "Frontend" "Platform & DevOps")
ICONS=("🟡" "🔴" "🟢" "🔵" "🟣")
COLORS=("33" "31" "32" "36" "35")
DESCS=(
    "架构师/Tech Lead — 任务分解与协调"
    "阿铁(Java) — Spring Cloud 微服务"
    "阿铁(Node) — Express + Agent Runtime"
    "小花 — Vue 3 + Nuxt 3"
    "阿维 — K8s + Terraform + CI/CD"
)

# 检测终端模拟器
_detect_terminal() {
    if command -v osascript &>/dev/null; then
        echo "macos"   # macOS: AppleScript -> Terminal.app or iTerm2
    elif command -v gnome-terminal &>/dev/null; then
        echo "gnome"   # Linux GNOME
    elif command -v konsole &>/dev/null; then
        echo "konsole" # Linux KDE
    elif command -v xterm &>/dev/null; then
        echo "xterm"   # fallback
    elif command -v tmux &>/dev/null; then
        echo "tmux"    # tmux fallback
    else
        echo "none"
    fi
}

# 安全地转义字符串用于 AppleScript
g# AppleScript 字符串转义：双引号转义为 \"
_escape_applescript() {
    printf '%s' "$1" | sed 's/"/\\"/g'
}

# 在新窗口/标签中启动 Agent
_start_agent() {
    local idx=$1
    local name=${NAMES[$idx]}
    local title=${TITLES[$idx]}
    local icon=${ICONS[$idx]}
    local color=${COLORS[$idx]}
    local desc=${DESCS[$idx]}
    local agent_file="$AGENTS_DIR/$name/agent.yaml"

    if [[ ! -f "$agent_file" ]]; then
        echo "  ⚠️  跳过 $icon $name — 配置文件不存在: $agent_file"
        return
    fi

    local window_title="$icon $title | AgentHive"
    local term=$(_detect_terminal)

    # 核心修复: 将启动命令写入临时脚本文件，完全避免引号嵌套问题
    # 旧代码将命令直接嵌入 osascript/gnome-terminal 的参数中，路径含空格/引号时必然崩溃
    local tmp_script
    tmp_script=$(mktemp "/tmp/agenthive-$name-XXXXXX.sh")
    chmod +x "$tmp_script"

    cat > "$tmp_script" <<'SCRIPT_EOF'
#!/usr/bin/env bash
set -e
SCRIPT_EOF

    # 追加 cd 命令（使用 printf %q 转义路径，防止特殊字符破坏）
    printf "cd %q\n" "$PROJECT_ROOT" >> "$tmp_script"

    # 追加显示信息的命令
    cat >> "$tmp_script" <<SCRIPT_EOF
    echo ""
    echo -e "\e[${color}m  $icon $title\e[0m"
    echo -e "\e[90m  $desc\e[0m"
    echo -e "\e[90m  Agent file: .kimi/agents/$name/agent.yaml\e[0m"
    echo -e "\e[90m  Working dir: $PROJECT_ROOT\e[0m"
    echo ""
SCRIPT_EOF

    # 追加 kimi 命令（使用 printf %q 转义 agent_file 路径）
    printf "    kimi --agent-file %q\n" "$agent_file" >> "$tmp_script"
    echo '    exit_code=$?' >> "$tmp_script"
    echo '    if [[ $exit_code -ne 0 ]]; then' >> "$tmp_script"
    echo "        echo -e \"\\e[31m  ❌ kimi 退出码: \$exit_code\\e[0m\"" >> "$tmp_script"
    echo '    fi' >> "$tmp_script"

    # 根据终端类型启动
    local launch_ok=false
    case "$term" in
        macos)
            # macOS Terminal.app
            local as_project_root as_agent_file as_title as_desc
            as_project_root=$(_escape_applescript "$PROJECT_ROOT")
            as_title=$(_escape_applescript "$title")
            as_desc=$(_escape_applescript "$desc")

            if osascript >/dev/null 2>&1 <<EOF &
tell application "Terminal"
    do script "clear; echo ''; echo '  $icon $as_title'; echo '  $as_desc'; echo ''; bash '$tmp_script'"
    set custom title of front window to "$icon $title | AgentHive"
end tell
EOF
            then
                launch_ok=true
            fi
            ;;
        gnome)
            if gnome-terminal --title="$window_title" -- bash -c "bash '$tmp_script'; exec bash" &>/dev/null &
            then
                launch_ok=true
            fi
            ;;
        konsole)
            if konsole --new-tab -p tabtitle="$window_title" -e bash -c "bash '$tmp_script'; exec bash" &>/dev/null &
            then
                launch_ok=true
            fi
            ;;
        xterm)
            if xterm -title "$window_title" -e bash -c "bash '$tmp_script'; exec bash" &>/dev/null &
            then
                launch_ok=true
            fi
            ;;
        tmux)
            local session="agenthive-$name"
            if tmux has-session -t "$session" 2>/dev/null; then
                echo "  ⚠️  tmux session '$session' 已存在，跳过"
                rm -f "$tmp_script"
                return
            fi
            if tmux new-session -d -s "$session" -n "$title" "bash '$tmp_script'" 2>/dev/null; then
                echo "  ✅ $icon $title 已在 tmux session '$session' 中启动"
                echo "      Attach: tmux attach -t $session"
                rm -f "$tmp_script"
                return
            else
                echo "  ❌ tmux session 创建失败"
            fi
            ;;
        none)
            echo "  ❌ 找不到支持的终端模拟器 (gnome-terminal/konsole/xterm/tmux)"
            echo "     请手动运行: cd '$PROJECT_ROOT' && kimi --agent-file '$agent_file'"
            echo "     或执行临时脚本: bash '$tmp_script'"
            rm -f "$tmp_script"
            return
            ;;
    esac

    if [[ "$launch_ok" == true ]]; then
        echo "  ✅ $icon $title 已启动"
    else
        echo "  ❌ $icon $title 启动失败"
        echo "     可手动执行: bash '$tmp_script'"
    fi

    # 清理临时脚本（保留 5 秒以便调试）
    (sleep 5 && rm -f "$tmp_script") &
}

# 列出角色
_list() {
    echo ""
    echo "  AgentHive Cloud — 可用 Kimi Agent 角色"
    echo "  ─────────────────────────────────────────────"
    for i in "${!NAMES[@]}"; do
        local agent_file="$AGENTS_DIR/${NAMES[$i]}/agent.yaml"
        local status="✅ 就绪"
        [[ ! -f "$agent_file" ]] && status="❌ 缺失"
        printf "  %s %-22s %s  [%s]\n" "${ICONS[$i]}" "${TITLES[$i]}" "${DESCS[$i]}" "$status"
    done
    echo ""
    echo "  用法: ./start-agents.sh [--list] [--wait] [role1 role2 ...]"
    echo "  示例: ./start-agents.sh java node    # 只启动 Java + Node"
    echo ""
}

# === 主逻辑 ===

echo ""
echo "  🐝 AgentHive Cloud — Agent 启动器"
echo "  项目根目录: $PROJECT_ROOT"
echo ""

# 检查项目根目录
if [[ ! -d "$AGENTS_DIR" ]]; then
    echo "❌ 错误: 找不到 Agent 配置目录: $AGENTS_DIR"
    echo "   请确保在 AgentHive Cloud 项目根目录下运行此脚本。"
    exit 1
fi

# 检查 kimi
if ! command -v kimi &>/dev/null; then
    echo "❌ 错误: 找不到 kimi 命令。请确保 Kimi Code CLI 已安装并在 PATH 中。"
    echo "   安装指南: https://www.kimi.com/code"
    exit 1
fi

# 解析参数
TARGETS=()
for arg in "$@"; do
    case "$arg" in
        --list|-l)
            _list
            exit 0
            ;;
        --wait|-w)
            WAIT_AFTER_START=true
            ;;
        --all|-a)
            TARGETS=("${NAMES[@]}")
            ;;
        -*)
            echo "  ⚠️  未知选项: $arg"
            ;;
        *)
            TARGETS+=("$arg")
            ;;
    esac
done

if [[ ${#TARGETS[@]} -eq 0 ]]; then
    TARGETS=("${NAMES[@]}")
fi

# 启动
COUNT=0
for target in "${TARGETS[@]}"; do
    FOUND=0
    for i in "${!NAMES[@]}"; do
        if [[ "${NAMES[$i]}" == "$target" ]]; then
            _start_agent "$i"
            FOUND=1
            ((COUNT++))
            sleep 0.5
            break
        fi
    done
    if [[ $FOUND -eq 0 ]]; then
        echo "  ⚠️  未知角色: $target。使用 --list 查看可用角色。"
    fi
done

echo ""
echo "  🚀 启动完成！共启动 $COUNT 个 Agent。"
echo ""

if [[ "$WAIT_AFTER_START" == true ]]; then
    echo "  按 Enter 键退出..."
    read -r
fi
