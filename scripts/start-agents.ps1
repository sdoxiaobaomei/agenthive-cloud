#Requires -Version 7.0
<#
.SYNOPSIS
    一键启动 AgentHive Cloud 的多角色 Kimi Agent
.DESCRIPTION
    为每个 specialist 角色启动一个独立的 Kimi CLI 实例，各角色隔离运行。
    每个 Agent 在一个独立的 PowerShell 窗口中启动，带有不同颜色的标题栏和窗口标题。

    修复记录 (2026-04-27):
    1. 使用 Base64 编码传递复杂命令，避免 Start-Process -ArgumentList 参数解析错误
    2. 重命名 $args 避免与 PowerShell 自动变量冲突
    3. 添加 Set-Location 确保 kimi 在正确工作目录运行
    4. 普通 PowerShell 回退也支持窗口标题设置
    5. 增强错误处理，捕获 kimi 启动失败
.PARAMETER All
    启动所有 Agent（默认行为）
.PARAMETER Lead
    启动 Team Lead (阿黄) — 架构设计与任务调度
.PARAMETER Java
    启动 Java Backend (阿铁 Java) — Java 微服务
.PARAMETER Node
    启动 Node Backend (阿铁 Node) — Node.js API + Agent Runtime
.PARAMETER Frontend
    启动 Frontend (小花) — Vue/Nuxt 前端
.PARAMETER Platform
    启动 Platform (阿维) — K8s/CI-CD/监控
.PARAMETER List
    列出可用角色而不启动
.PARAMETER Wait
    启动后等待用户按键再退出（用于调试）
.EXAMPLE
    .\start-agents.ps1                  # 启动全部
    .\start-agents.ps1 -Java -Node      # 只启动 Java + Node
    .\start-agents.ps1 -List            # 查看角色列表
#>
[CmdletBinding()]
param(
    [switch]$All,
    [switch]$Lead,
    [switch]$Java,
    [switch]$Node,
    [switch]$Frontend,
    [switch]$Platform,
    [switch]$List,
    [switch]$Wait
)

# === 配置 ===
$ScriptDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir
$AgentsDir = Join-Path $ProjectRoot ".kimi\agents"

$AgentConfigs = @(
    @{ Name = "lead";     Title = "AgentHive Lead";      Icon = "🟡"; Color = "Yellow";    Desc = "架构师/Tech Lead — 任务分解与协调" },
    @{ Name = "java";     Title = "Java Backend";        Icon = "🔴"; Color = "Red";       Desc = "阿铁(Java) — Spring Cloud 微服务" },
    @{ Name = "node";     Title = "Node Backend";        Icon = "🟢"; Color = "Green";     Desc = "阿铁(Node) — Express + Agent Runtime" },
    @{ Name = "frontend"; Title = "Frontend";            Icon = "🔵"; Color = "Cyan";      Desc = "小花 — Vue 3 + Nuxt 3" },
    @{ Name = "platform"; Title = "Platform & DevOps";   Icon = "🟣"; Color = "Magenta";   Desc = "阿维 — K8s + Terraform + CI/CD" }
)

# === 功能函数 ===

function Test-ProjectRoot {
    if (-not (Test-Path $AgentsDir)) {
        Write-Host "❌ 错误: 找不到 Agent 配置目录: $AgentsDir" -ForegroundColor Red
        Write-Host "   请确保在 AgentHive Cloud 项目根目录下运行此脚本。" -ForegroundColor DarkGray
        exit 1
    }
}

function Test-KimiInstalled {
    $kimi = Get-Command kimi -ErrorAction SilentlyContinue
    if (-not $kimi) {
        Write-Host "❌ 错误: 找不到 kimi 命令。请确保 Kimi Code CLI 已安装并在 PATH 中。" -ForegroundColor Red
        Write-Host "   安装指南: https://www.kimi.com/code" -ForegroundColor DarkGray
        exit 1
    }
    return $kimi.Source
}

function Start-AgentWindow {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$Title,
        [Parameter(Mandatory)] [string]$Icon,
        [Parameter(Mandatory)] [string]$Color,
        [Parameter(Mandatory)] [string]$Desc
    )

    $agentFile = Join-Path $AgentsDir $Name "agent.yaml"
    if (-not (Test-Path $agentFile)) {
        Write-Host "  ⚠️  跳过 $Icon $Name — 配置文件不存在: $agentFile" -ForegroundColor DarkYellow
        return
    }

    $windowTitle = "$Icon $Title | AgentHive"

    # 构建要在新窗口中执行的 PowerShell 命令
    # 注意: 使用单引号包裹路径，避免路径中的特殊字符被解析
    $agentFileEscaped = $agentFile -replace "'", "''"
    $projectRootEscaped = $ProjectRoot -replace "'", "''"

    $innerScript = @"
try {
    Set-Location -LiteralPath '$projectRootEscaped'
    `$Host.UI.RawUI.WindowTitle = '$windowTitle'
    Write-Host ""
    Write-Host "  $Icon $Title" -ForegroundColor $Color
    Write-Host "  $Desc" -ForegroundColor DarkGray
    Write-Host "  Agent file: .kimi\agents\$Name\agent.yaml" -ForegroundColor DarkGray
    Write-Host "  Working dir: $projectRootEscaped" -ForegroundColor DarkGray
    Write-Host ""
    & kimi --agent-file '$agentFileEscaped'
    if (`$LASTEXITCODE -ne 0) {
        Write-Host "  ❌ kimi 退出码: `$LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ 启动失败: `$(`$_.Exception.Message)" -ForegroundColor Red
}
"@

    # 将命令进行 Base64 编码，避免 Start-Process -ArgumentList 的参数解析问题
    # 这是修复的核心: 复杂多行命令通过 -EncodedCommand 传递，完全避免引号和空格问题
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($innerScript)
    $encodedCommand = [Convert]::ToBase64String($bytes)

    # 优先尝试 Windows Terminal (wt.exe)，回退到普通 powershell
    $wt = Get-Command wt.exe -ErrorAction SilentlyContinue
    if ($wt) {
        # wt.exe 参数: 每个参数独立传递，避免字符串拼接问题
        $wtArgs = @(
            "new-tab",
            "--title", $windowTitle,
            "--directory", $ProjectRoot,
            "powershell.exe", "-NoExit", "-EncodedCommand", $encodedCommand
        )
        try {
            Start-Process wt.exe -ArgumentList $wtArgs -WindowStyle Normal -ErrorAction Stop
            Write-Host "  ✅ $Icon $Title 已启动 (Windows Terminal)" -ForegroundColor $Color
        } catch {
            Write-Host "  ⚠️  Windows Terminal 启动失败，回退到普通 PowerShell: $($_.Exception.Message)" -ForegroundColor DarkYellow
            Start-Process powershell.exe -ArgumentList "-NoExit", "-EncodedCommand", $encodedCommand -WindowStyle Normal
            Write-Host "  ✅ $Icon $Title 已启动 (PowerShell)" -ForegroundColor $Color
        }
    }
    else {
        # 普通 PowerShell: 使用 -WindowTitle 参数设置标题
        Start-Process powershell.exe -ArgumentList "-NoExit", "-WindowTitle", $windowTitle, "-EncodedCommand", $encodedCommand -WindowStyle Normal
        Write-Host "  ✅ $Icon $Title 已启动 (PowerShell)" -ForegroundColor $Color
    }
}

function Show-AgentList {
    Write-Host ""
    Write-Host "  AgentHive Cloud — 可用 Kimi Agent 角色" -ForegroundColor White
    Write-Host "  $([string]::new('─', 50))" -ForegroundColor DarkGray
    foreach ($cfg in $AgentConfigs) {
        $agentFile = Join-Path $AgentsDir $cfg.Name "agent.yaml"
        $status = if (Test-Path $agentFile) { "✅ 就绪" } else { "❌ 缺失" }
        Write-Host "  $($cfg.Icon) $($cfg.Title.PadRight(22))  $($cfg.Desc)  [$status]" -ForegroundColor $cfg.Color
    }
    Write-Host ""
    Write-Host "  用法: .\start-agents.ps1 [-All] [-Lead] [-Java] [-Node] [-Frontend] [-Platform]" -ForegroundColor DarkGray
    Write-Host "  示例: .\start-agents.ps1 -Java -Node    # 只启动 Java + Node Agent" -ForegroundColor DarkGray
    Write-Host ""
}

# === 主逻辑 ===

Write-Host ""
Write-Host "  🐝 AgentHive Cloud — Agent 启动器" -ForegroundColor Yellow
Write-Host "  项目根目录: $ProjectRoot" -ForegroundColor DarkGray
Write-Host ""

# 检查环境
Test-ProjectRoot
$kimiPath = Test-KimiInstalled
Write-Host "  📍 kimi: $kimiPath" -ForegroundColor DarkGray
Write-Host ""

# 只列出角色
if ($List) {
    Show-AgentList
    exit 0
}

# 确定要启动哪些
if (-not ($Lead -or $Java -or $Node -or $Frontend -or $Platform -or $All)) {
    $All = $true
}

$toStart = [System.Collections.Generic.List[hashtable]]::new()
foreach ($cfg in $AgentConfigs) {
    $flagName = $cfg.Name.Substring(0,1).ToUpper() + $cfg.Name.Substring(1)
    if ($All -or (Get-Variable $flagName -ValueOnly)) {
        $toStart.Add($cfg)
    }
}

if ($toStart.Count -eq 0) {
    Write-Host "⚠️  没有指定要启动的角色。使用 -All 启动全部，或使用 -List 查看列表。" -ForegroundColor DarkYellow
    exit 0
}

Write-Host "  正在启动 $($toStart.Count) 个 Agent..." -ForegroundColor White
Write-Host ""

foreach ($cfg in $toStart) {
    Start-AgentWindow -Name $cfg.Name -Title $cfg.Title -Icon $cfg.Icon -Color $cfg.Color -Desc $cfg.Desc
    Start-Sleep -Milliseconds 500  # 增加间隔，避免窗口同时弹出导致的焦点争夺
}

Write-Host ""
Write-Host "  🚀 全部启动完成！每个 Agent 在独立窗口中运行。" -ForegroundColor Green
Write-Host ""

if ($Wait) {
    Write-Host "  按任意键退出..." -ForegroundColor DarkGray
    [void][System.Console]::ReadKey($true)
}
