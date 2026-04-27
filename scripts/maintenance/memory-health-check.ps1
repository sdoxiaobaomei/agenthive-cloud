#Requires -Version 7
<#
.SYNOPSIS
    AgentHive Cloud — Memory Health Check
    检查 .kimi/memory/ 目录的健康状态，防止记忆膨胀。

.DESCRIPTION
    每周运行一次，输出记忆健康报告。
    指标超过阈值时输出 WARNING，建议执行压缩或审查。

.EXAMPLE
    .\scripts\maintenance\memory-health-check.ps1
    .\scripts\maintenance\memory-health-check.ps1 -Fix
#>
param(
    [switch]$Fix,
    [string]$MemoryRoot = ".kimi/memory"
)

$ErrorActionPreference = "Stop"
$hasError = $false

function Write-Metric($Name, $Value, $Threshold, $Unit = "") {
    $status = if ($Value -gt $Threshold) { "WARNING"; $script:hasError = $true } else { "OK" }
    $color = if ($status -eq "WARNING") { "Red" } else { "Green" }
    Write-Host ("[{0}] {1}: {2}{3} (threshold: {4}{5})" -f $status, $Name, $Value, $Unit, $Threshold, $Unit) -ForegroundColor $color
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "AgentHive Cloud — Memory Health Check" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# --- Metric 1: Reflections count ---
$reflectionCount = (Get-ChildItem -Path "$MemoryRoot/reflections" -Filter "*.md" -ErrorAction SilentlyContinue).Count
Write-Metric -Name "Reflections (active)" -Value $reflectionCount -Threshold 30

# --- Metric 2: Skills per role ---
$roles = @("java", "node", "frontend", "platform")
foreach ($role in $roles) {
    $officialCount = (Get-ChildItem -Path "$MemoryRoot/skills/$role/official" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue).Count
    $draftCount = (Get-ChildItem -Path "$MemoryRoot/skills/$role/draft" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue).Count
    Write-Metric -Name "Skills [$role] official" -Value $officialCount -Threshold 50
    Write-Metric -Name "Skills [$role] draft" -Value $draftCount -Threshold 10
}

# --- Metric 3: lessons-learned.md size ---
$llPath = "$MemoryRoot/shared/lessons-learned.md"
if (Test-Path $llPath) {
    $llSizeKB = [math]::Round((Get-Item $llPath).Length / 1KB, 1)
    Write-Metric -Name "lessons-learned.md size" -Value $llSizeKB -Threshold 10 -Unit "KB"
}

# --- Metric 4: Archive size ---
$archivePaths = @(
    "$MemoryRoot/archive",
    "$MemoryRoot/reflections/archive"
)
$totalArchiveKB = 0
foreach ($ap in $archivePaths) {
    if (Test-Path $ap) {
        $size = (Get-ChildItem -Path $ap -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $totalArchiveKB += [math]::Round($size / 1KB, 1)
    }
}
Write-Metric -Name "Archive total size" -Value $totalArchiveKB -Threshold 500 -Unit "KB"

# --- Metric 5: Episodes count ---
$episodeCount = (Get-ChildItem -Path "$MemoryRoot/episodes" -Filter "*.md" -ErrorAction SilentlyContinue).Count
Write-Metric -Name "Episodes (active)" -Value $episodeCount -Threshold 20

# --- Fix mode ---
if ($Fix -and $hasError) {
    Write-Host ""
    Write-Host "[FIX MODE] Recommendations:" -ForegroundColor Yellow
    if ($reflectionCount -gt 30) {
        Write-Host "  → Run: .\scripts\maintenance\compress-reflections.ps1" -ForegroundColor Yellow
    }
    $totalDraft = 0
    foreach ($role in $roles) {
        $totalDraft += (Get-ChildItem -Path "$MemoryRoot/skills/$role/draft" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue).Count
    }
    if ($totalDraft -gt 10) {
        Write-Host "  → Run: .\scripts\maintenance\review-skills.ps1" -ForegroundColor Yellow
    }
    if ($llSizeKB -gt 10) {
        Write-Host "  → Archive lessons-learned.md to lessons-learned-archive.md" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($hasError) {
    Write-Host "Result: WARNING — Memory maintenance recommended" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Result: OK — Memory health is good" -ForegroundColor Green
    exit 0
}
