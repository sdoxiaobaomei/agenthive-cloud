<#
.SYNOPSIS
    AgentHive Cloud — Lead Behavior Check
    检查 Lead (阿黄) 是否遵守行为红线。

.DESCRIPTION
    在 Lead 执行操作前/后运行，检测越权行为：
      - 直接修改 apps/ 目录下的代码文件
      - 直接执行构建/部署命令（mvn/docker/kubectl/terraform）
      - 使用 PowerShell 批量修改文件

.EXAMPLE
    .\scripts\maintenance\lead-behavior-check.ps1
    .\scripts\maintenance\lead-behavior-check.ps1 -RecentMinutes 60
#>
param(
    [int]$RecentMinutes = 60,
    [string]$WorkspaceRoot = "."
)

$ErrorActionPreference = "Stop"
$violations = @()

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Lead Behavior Check" -ForegroundColor Cyan
Write-Host "Window: last $RecentMinutes minutes" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# --- Check 1: Direct code modification in apps/ ---
$appDirs = @("apps/java", "apps/api", "apps/landing", "apps/agent-runtime")
$cutoff = (Get-Date).AddMinutes(-$RecentMinutes)

foreach ($dir in $appDirs) {
    $fullDir = Join-Path $WorkspaceRoot $dir
    if (Test-Path $fullDir) {
        $recentFiles = Get-ChildItem -Path $fullDir -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
            $_.LastWriteTime -gt $cutoff -and
            $_.Extension -match "\.(java|ts|tsx|vue|js|yml|yaml|tf)$"
        }
        foreach ($f in $recentFiles) {
            $violations += [PSCustomObject]@{
                Type = "DIRECT_CODE_EDIT"
                File = $f.FullName.Replace((Resolve-Path $WorkspaceRoot).Path + "\", "")
                Time = $f.LastWriteTime.ToString("HH:mm:ss")
                Severity = "CRITICAL"
                Message = "Lead 直接修改了业务代码文件。应派工给 Specialist。"
            }
        }
    }
}

# --- Check 2: Build/deploy command traces (check shell history if available) ---
# 注：在 Agent 环境中无法直接读取 shell history，改为检查最近修改的 Dockerfile/docker-compose
$infraFiles = @("docker-compose.dev.yml", "docker-compose.prod.yml", "Dockerfile", "k8s/")
foreach ($infra in $infraFiles) {
    $fullPath = Join-Path $WorkspaceRoot $infra
    if (Test-Path $fullPath) {
        $recent = Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
            $_.LastWriteTime -gt $cutoff
        } | Select-Object -First 5
        foreach ($f in $recent) {
            $violations += [PSCustomObject]@{
                Type = "INFRA_MODIFICATION"
                File = $f.FullName.Replace((Resolve-Path $WorkspaceRoot).Path + "\", "")
                Time = $f.LastWriteTime.ToString("HH:mm:ss")
                Severity = "WARNING"
                Message = "Lead 修改了基础设施配置。如非紧急，应派工给 Platform Specialist。"
            }
        }
    }
}

# --- Check 3: lessons-learned.md token limit ---
$llPath = Join-Path $WorkspaceRoot ".kimi/memory/shared/lessons-learned.md"
if (Test-Path $llPath) {
    $content = Get-Content $llPath -Raw
    $tokens = [math]::Round($content.Length * 0.6)
    if ($tokens -gt 3000) {
        $violations += [PSCustomObject]@{
            Type = "BOUNDED_MEMORY_VIOLATION"
            File = ".kimi/memory/shared/lessons-learned.md"
            Time = "N/A"
            Severity = "WARNING"
            Message = "lessons-learned.md 超过 3K tokens 硬上限（当前: $tokens）。需归档旧条目。"
        }
    }
}

# --- Check 4: AGENTS/ directory integrity ---
$workspaceDir = Join-Path $WorkspaceRoot "AGENTS/workspace"
if (Test-Path $workspaceDir) {
    $tickets = Get-ChildItem -Path $workspaceDir -Directory
    $incomplete = 0
    foreach ($t in $tickets) {
        $hasTicket = Test-Path "$($t.FullName)/TICKET.yaml"
        $hasResponse = Test-Path "$($t.FullName)/RESPONSE.yaml"
        $hasReview = Test-Path "$($t.FullName)/LEAD_REVIEW.yaml"
        if ($hasTicket -and $hasResponse -and -not $hasReview) {
            $incomplete++
        }
    }
    if ($incomplete -gt 0) {
        $violations += [PSCustomObject]@{
            Type = "WORKFLOW_GAP"
            File = "AGENTS/workspace/"
            Time = "N/A"
            Severity = "WARNING"
            Message = "$incomplete 个 Ticket 有 RESPONSE 但无 LEAD_REVIEW。Lead 审查步骤缺失。"
        }
    }
}

# --- Report ---
Write-Host ""
if ($violations.Count -eq 0) {
    Write-Host "Result: PASS — No violations detected" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Result: FAIL — $($violations.Count) violation(s) detected" -ForegroundColor Red
    Write-Host ""
    $violations | Format-Table -AutoSize
    Write-Host ""
    Write-Host " remediation:" -ForegroundColor Yellow
    foreach ($v in $violations) {
        if ($v.Type -eq "DIRECT_CODE_EDIT") {
            Write-Host "  → REVERT the change and dispatch to appropriate Specialist" -ForegroundColor Yellow
        } elseif ($v.Type -eq "BOUNDED_MEMORY_VIOLATION") {
            Write-Host "  → Archive old entries to lessons-learned-archive.md" -ForegroundColor Yellow
        } elseif ($v.Type -eq "WORKFLOW_GAP") {
            Write-Host "  -> Complete LEAD_REVIEW.yaml for pending tickets" -ForegroundColor Yellow
        }
    }
    exit 1
}
