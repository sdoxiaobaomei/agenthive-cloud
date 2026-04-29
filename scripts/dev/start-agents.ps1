#Requires -Version 5.1
<#
.SYNOPSIS
    一键启动 AgentHive Cloud 的多角色 Kimi Agent
.DESCRIPTION
    为每个 specialist 角色启动一个独立的 Kimi CLI 实例，各角色隔离运行。
    每个 Agent 在一个独立的 PowerShell 窗口中启动。

    修复记录 (2026-04-27 v3):
    - 移除 Base64 编码，改为生成临时 .ps1 文件
    - 自动优先使用 pwsh (PowerShell 7)，回退到 powershell (5.1)
    - 添加 -DryRun 参数，可预览命令而不实际启动
    - 修复 PowerShell 5.1 语法兼容问题
.PARAMETER All
    启动所有 Agent（默认行为）
.PARAMETER Lead
    启动 Team Lead (阿黄)
.PARAMETER Java
    启动 Java Backend (阿铁 Java)
.PARAMETER Node
    启动 Node Backend (阿铁 Node)
.PARAMETER Frontend
    启动 Frontend (小花)
.PARAMETER Platform
    启动 Platform (阿维)
.PARAMETER List
    列出可用角色而不启动
.PARAMETER DryRun
    预览将要执行的命令，不实际启动窗口
.EXAMPLE
    pwsh .\start-agents.ps1                  # 启动全部（推荐用 pwsh）
    pwsh .\start-agents.ps1 -Java -Node      # 只启动 Java + Node
    pwsh .\start-agents.ps1 -List            # 查看角色列表
    pwsh .\start-agents.ps1 -DryRun -Java    # 预览 Java Agent 的启动命令
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
    [switch]$DryRun
)

# === 配置 ===
$ScriptDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir
$AgentsDir = Join-Path $ProjectRoot ".kimi\agents"

# 检测可用的 PowerShell 可执行文件（优先 pwsh 7）
$PwshExe = Get-Command pwsh -ErrorAction SilentlyContinue
if (-not $PwshExe) {
    $PwshExe = Get-Command powershell -ErrorAction SilentlyContinue
}
if (-not $PwshExe) {
    Write-Host "错误: 找不到 pwsh 或 powershell 命令。" -ForegroundColor Red
    exit 1
}

$AgentConfigs = @(
    @{ Name = "lead";     Title = "AgentHive Lead";      Icon = "[Lead]";     Color = "Yellow";    Desc = "架构师/Tech Lead -- 任务分解与协调" },
    @{ Name = "java";     Title = "Java Backend";        Icon = "[Java]";     Color = "Red";       Desc = "阿铁(Java) -- Spring Cloud 微服务" },
    @{ Name = "node";     Title = "Node Backend";        Icon = "[Node]";     Color = "Green";     Desc = "阿铁(Node) -- Express + Agent Runtime" },
    @{ Name = "frontend"; Title = "Frontend";            Icon = "[Frontend]"; Color = "Cyan";      Desc = "小花 -- Vue 3 + Nuxt 3" },
    @{ Name = "platform"; Title = "Platform and DevOps"; Icon = "[Platform]"; Color = "Magenta";   Desc = "阿维 -- K8s + Terraform + CI/CD" }
)

# === 功能函数 ===

function Test-ProjectRoot {
    if (-not (Test-Path $AgentsDir)) {
        Write-Host "错误: 找不到 Agent 配置目录: $AgentsDir" -ForegroundColor Red
        Write-Host "   请确保在 AgentHive Cloud 项目根目录下运行此脚本。" -ForegroundColor DarkGray
        exit 1
    }
}

function Test-KimiInstalled {
    $kimi = Get-Command kimi -ErrorAction SilentlyContinue
    if (-not $kimi) {
        Write-Host "错误: 找不到 kimi 命令。请确保 Kimi Code CLI 已安装并在 PATH 中。" -ForegroundColor Red
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

    $agentFile = Join-Path (Join-Path $AgentsDir $Name) "agent.yaml"
    if (-not (Test-Path $agentFile)) {
        Write-Host "  跳过 $Icon $Name -- 配置文件不存在: $agentFile" -ForegroundColor DarkYellow
        return
    }

    $windowTitle = "$Icon $Title | AgentHive"

    # 核心修复: 生成临时 .ps1 文件，完全避免引号嵌套和 Base64 编码问题
    $tmpFile = Join-Path $env:TEMP "agenthive-$Name-$(Get-Random).ps1"

    # 使用 here-string 构建脚本内容，避免复杂的字符串拼接
    $tmpContent = @"
# AgentHive Cloud -- $Title 启动脚本（自动生成）
# 修复编码问题: 强制 UTF-8，避免 kimi CLI 的 'gbk codec' 错误
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8
`$env:PYTHONIOENCODING = "utf-8"
`$Host.UI.RawUI.WindowTitle = '$windowTitle'
Set-Location -LiteralPath '$($ProjectRoot -replace "'","''")'
Write-Host ""
Write-Host "  $Icon $Title" -ForegroundColor $Color
Write-Host "  $Desc" -ForegroundColor DarkGray
Write-Host "  Agent file: .kimi\agents\$Name\agent.yaml" -ForegroundColor DarkGray
Write-Host "  Working dir: $ProjectRoot" -ForegroundColor DarkGray
Write-Host "  PowerShell:  $($PwshExe.Source)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  正在启动 kimi ..." -ForegroundColor $Color
Write-Host ""
try {
    & kimi --agent-file '$($agentFile -replace "'","''")' --work-dir '$($ProjectRoot -replace "'","''")'
    `$exitCode = `$LASTEXITCODE
    if (`$exitCode -ne 0) {
        Write-Host "  kimi 退出码: `$exitCode" -ForegroundColor Red
        Write-Host "   可能原因: 终端编码不支持 Unicode 字符，或 kimi CLI 内部错误" -ForegroundColor DarkGray
        Write-Host "   日志位置: ~\.kimi\logs\kimi.log" -ForegroundColor DarkGray
    } else {
        Write-Host "  kimi 正常退出" -ForegroundColor Green
    }
} catch {
    Write-Host "  启动失败: `$(`$_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Write-Host "  按 Enter 键关闭窗口..." -ForegroundColor DarkGray
`$null = Read-Host
"@

    # 写入临时文件（使用 UTF-8 BOM，确保中文正确显示）
    [System.IO.File]::WriteAllText($tmpFile, $tmpContent, [System.Text.Encoding]::UTF8)

    if ($DryRun) {
        Write-Host ""
        Write-Host "  === DryRun: $Icon $Title ===" -ForegroundColor $Color
        Write-Host "  临时脚本: $tmpFile" -ForegroundColor DarkGray
        Write-Host "  执行命令: $($PwshExe.Source) -NoExit -File `"$tmpFile`"" -ForegroundColor DarkGray
        Write-Host ""
        return
    }

    # 启动新窗口执行临时脚本
    $wt = Get-Command wt.exe -ErrorAction SilentlyContinue
    if ($wt) {
        try {
            $wtArgs = @(
                "new-tab",
                "--title", $windowTitle,
                "--directory", $ProjectRoot,
                $PwshExe.Source, "-NoExit", "-File", $tmpFile
            )
            Start-Process wt.exe -ArgumentList $wtArgs -WindowStyle Normal -ErrorAction Stop
            Write-Host "  $Icon $Title 已启动 (Windows Terminal)" -ForegroundColor $Color
        } catch {
            Write-Host "  Windows Terminal 启动失败，回退到普通 PowerShell" -ForegroundColor DarkYellow
            Start-Process $PwshExe.Source -ArgumentList "-NoExit", "-WindowTitle", $windowTitle, "-File", $tmpFile -WindowStyle Normal
            Write-Host "  $Icon $Title 已启动 (PowerShell)" -ForegroundColor $Color
        }
    }
    else {
        Start-Process $PwshExe.Source -ArgumentList "-NoExit", "-WindowTitle", $windowTitle, "-File", $tmpFile -WindowStyle Normal
        Write-Host "  $Icon $Title 已启动 (PowerShell)" -ForegroundColor $Color
    }
}

function Show-AgentList {
    Write-Host ""
    Write-Host "  AgentHive Cloud -- 可用 Kimi Agent 角色" -ForegroundColor White
    Write-Host "  $("-" * 50)" -ForegroundColor DarkGray
    foreach ($cfg in $AgentConfigs) {
        $agentFile = Join-Path (Join-Path $AgentsDir $cfg.Name) "agent.yaml"
        $status = if (Test-Path $agentFile) { "OK" } else { "MISSING" }
        Write-Host "  $($cfg.Icon) $($cfg.Title.PadRight(22))  $($cfg.Desc)  [$status]" -ForegroundColor $cfg.Color
    }
    Write-Host ""
    Write-Host "  用法: pwsh .\start-agents.ps1 [-All] [-Lead] [-Java] [-Node] [-Frontend] [-Platform]" -ForegroundColor DarkGray
    Write-Host "  调试: pwsh .\start-agents.ps1 -DryRun -Java   # 预览命令" -ForegroundColor DarkGray
    Write-Host ""
}

# === 主逻辑 ===

Write-Host ""
Write-Host "  AgentHive Cloud -- Agent 启动器" -ForegroundColor Yellow
Write-Host "  项目根目录: $ProjectRoot" -ForegroundColor DarkGray
Write-Host "  PowerShell: $($PwshExe.Source)" -ForegroundColor DarkGray
Write-Host ""

# 检查环境
Test-ProjectRoot
$kimiPath = Test-KimiInstalled
Write-Host "  kimi: $kimiPath" -ForegroundColor DarkGray
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
    Write-Host "没有指定要启动的角色。使用 -All 启动全部，或使用 -List 查看列表。" -ForegroundColor DarkYellow
    exit 0
}

if ($DryRun) {
    Write-Host "  [DryRun 模式] 预览 $($toStart.Count) 个 Agent 的启动命令..." -ForegroundColor Yellow
} else {
    Write-Host "  正在启动 $($toStart.Count) 个 Agent..." -ForegroundColor White
}
Write-Host ""

foreach ($cfg in $toStart) {
    Start-AgentWindow -Name $cfg.Name -Title $cfg.Title -Icon $cfg.Icon -Color $cfg.Color -Desc $cfg.Desc
    if (-not $DryRun) {
        Start-Sleep -Milliseconds 800
    }
}

Write-Host ""
if ($DryRun) {
    Write-Host "  [DryRun 完成] 未实际启动任何窗口。" -ForegroundColor Yellow
    Write-Host "  去掉 -DryRun 参数即可正式运行。" -ForegroundColor DarkGray
} else {
    Write-Host "  全部启动完成！每个 Agent 在独立窗口中运行。" -ForegroundColor Green
}
Write-Host ""