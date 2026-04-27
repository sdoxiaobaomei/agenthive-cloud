#!/usr/bin/env bash
# AgentHive Cloud — 多角色 Kimi Agent 一键启动脚本 (Linux/macOS)
# Usage:
#   ./start-agents.sh              # 启动全部
#   ./start-agents.sh java node    # 只启动 Java + Node
#   ./start-agents.sh --list       # 列出可用角色

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="$PROJECT_ROOT/.kimi/agents"

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

    local cmd="cd '$PROJECT_ROOT' && kimi --agent-file '$agent_file'"
    local term=$(_detect_terminal)

    case "$term" in
        macos)
            # macOS Terminal.app
            osascript <<EOF &
tell application "Terminal"
    do script "cd '$PROJECT_ROOT'; clear; echo ''; echo '  $icon $title' | cat; echo '  $desc' | cat; echo ''; $cmd"
    set custom title of front window to "$icon $title | AgentHive"
end tell
EOF
            ;;
        gnome)
            gnome-terminal --title="$icon $title | AgentHive" -- bash -c "
                echo -e \"\e[${color}m  $icon $title\e[0m\";
                echo -e \"\e[90m  $desc\e[0m\";
                echo '';
                $cmd;
                exec bash
            " &
            ;;
        konsole)
            konsole --new-tab -p tabtitle="$icon $title | AgentHive" -e bash -c "
                echo -e \"\e[${color}m  $icon $title\e[0m\";
                echo -e \"\e[90m  $desc\e[0m\";
                echo '';
                $cmd;
                exec bash
            " &
            ;;
        xterm)
            xterm -title "$icon $title | AgentHive" -e bash -c "
                echo -e \"\e[${color}m  $icon $title\e[0m\";
                echo -e \"\e[90m  $desc\e[0m\";
                echo '';
                $cmd;
                exec bash
            " &
            ;;
        tmux)
            local session="agenthive-$name"
            tmux new-session -d -s "$session" -n "$title" \
                "echo -e \"\\e[${color}m  $icon $title\\e[0m\"; echo ''; $cmd" 2>/dev/null || true
            echo "  ✅ $icon $title 已在 tmux session '$session' 中启动"
            echo "      Attach: tmux attach -t $session"
            return
            ;;
        none)
            echo "  ❌ 找不到支持的终端模拟器 (gnome-terminal/konsole/xterm/tmux)"
            echo "     请手动运行: cd '$PROJECT_ROOT' && kimi --agent-file '$agent_file'"
            return
            ;;
    esac

    echo "  ✅ $icon $title 已启动"
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
    echo "  用法: ./start-agents.sh [--list] [role1 role2 ...]"
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
    exit 1
fi

# 解析参数
if [[ $# -eq 0 ]] || [[ "$*" == *"--all"* ]]; then
    TARGETS=("${NAMES[@]}")
else
    if [[ "$1" == "--list" ]] || [[ "$1" == "-l" ]]; then
        _list
        exit 0
    fi
    TARGETS=("$@")
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
            sleep 0.3
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
