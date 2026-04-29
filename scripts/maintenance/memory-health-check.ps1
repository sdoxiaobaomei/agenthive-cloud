<#
.SYNOPSIS
    AgentHive Cloud — Memory Health Check (Token-Based v2.0)
    基于 Token 数量检查 .kimi/memory/ 目录的健康状态。

.DESCRIPTION
    管理单位从"文件数/天数/KB"改为"tokens"。
    上下文窗口是 Agent 的稀缺资源，Token 是唯一通用单位。
    
    触发条件:
      - reflections/ 总 tokens > 15K → 压缩
      - episodes/ 总 tokens > 30K → 合并
      - skills/*/official/ 总 tokens > 20K → 审查
      - lessons-learned.md > 3K → 归档
      - 单个 skill/reflection > 1.5K → 拆分/压缩
      - 单个 episode > 2K → 拆分/压缩

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

function Estimate-Tokens($Text) {
    # 简化估算：混合中英文场景
    # 中文字符 ≈ 1 token，英文单词 ≈ 1.3 tokens
    # 粗略公式：字符数 × 0.6（经验系数）
    if ($Text -is [string]) {
        return [math]::Round($Text.Length * 0.6)
    }
    return 0
}

function Get-FileTokens($Path) {
    if (Test-Path $Path) {
        $content = Get-Content $Path -Raw -ErrorAction SilentlyContinue
        return Estimate-Tokens $content
    }
    return 0
}

function Get-DirTokens($Path, $Filter = "*.md") {
    $total = 0
    if (Test-Path $Path) {
        $files = Get-ChildItem -Path $Path -Recurse -Filter $Filter -ErrorAction SilentlyContinue
        foreach ($f in $files) {
            $total += Get-FileTokens $f.FullName
        }
    }
    return $total
}

function Write-Metric($Name, $Value, $Threshold, $Unit = "tokens") {
    $status = if ($Value -gt $Threshold) { "WARNING"; $script:hasError = $true } else { "OK" }
    $color = if ($status -eq "WARNING") { "Red" } else { "Green" }
    Write-Host ("[{0}] {1}: {2:N0} {3} (threshold: {4:N0} {3})" -f $status, $Name, $Value, $Unit, $Threshold) -ForegroundColor $color
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "AgentHive Cloud — Memory Health Check (v2.0)" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "Unit: tokens (estimated)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# --- Metric 1: Reflections total tokens ---
$reflectionTokens = Get-DirTokens "$MemoryRoot/reflections"
Write-Metric -Name "Reflections total" -Value $reflectionTokens -Threshold 15000

# --- Metric 2: Episodes total tokens ---
$episodeTokens = Get-DirTokens "$MemoryRoot/episodes"
Write-Metric -Name "Episodes total" -Value $episodeTokens -Threshold 30000

# --- Metric 3: Skills per role ---
$roles = @("java", "node", "frontend", "platform")
foreach ($role in $roles) {
    $officialTokens = Get-DirTokens "$MemoryRoot/skills/$role/official"
    $draftCount = (Get-ChildItem -Path "$MemoryRoot/skills/$role/draft" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue).Count
    Write-Metric -Name "Skills [$role] official" -Value $officialTokens -Threshold 20000
    # draft 只报数量（通常很小）
    if ($draftCount -gt 0) {
        Write-Host "[INFO] Skills [$role] draft: $draftCount files" -ForegroundColor Cyan
    }
}

# --- Metric 4: lessons-learned.md tokens ---
$llTokens = Get-FileTokens "$MemoryRoot/shared/lessons-learned.md"
Write-Metric -Name "lessons-learned.md" -Value $llTokens -Threshold 3000

# --- Metric 5: Per-file limits ---
Write-Host ""
Write-Host "--- Per-file token limits ---" -ForegroundColor Yellow

$allSkills = Get-ChildItem -Path "$MemoryRoot/skills" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue | Where-Object { $_.DirectoryName -like "*official*" -or $_.DirectoryName -like "*draft*" }
foreach ($f in $allSkills) {
    $tokens = Get-FileTokens $f.FullName
    $limit = 1500
    if ($tokens -gt $limit) {
        Write-Host "[WARNING] $($f.Name): $tokens tokens > $limit limit" -ForegroundColor Red
        $script:hasError = $true
    }
}

$allReflections = Get-ChildItem -Path "$MemoryRoot/reflections" -Filter "*.md" -ErrorAction SilentlyContinue
foreach ($f in $allReflections) {
    $tokens = Get-FileTokens $f.FullName
    if ($tokens -gt 1500) {
        Write-Host "[WARNING] $($f.Name): $tokens tokens > 1500 limit" -ForegroundColor Red
        $script:hasError = $true
    }
}

$allEpisodes = Get-ChildItem -Path "$MemoryRoot/episodes" -Filter "*.md" -ErrorAction SilentlyContinue
foreach ($f in $allEpisodes) {
    $tokens = Get-FileTokens $f.FullName
    if ($tokens -gt 2000) {
        Write-Host "[WARNING] $($f.Name): $tokens tokens > 2000 limit" -ForegroundColor Red
        $script:hasError = $true
    }
}

# --- Fix mode ---
if ($Fix -and $hasError) {
    Write-Host ""
    Write-Host "[FIX MODE] Recommendations:" -ForegroundColor Yellow
    if ($reflectionTokens -gt 15000) {
        Write-Host "  → Run: .\scripts\maintenance\compress-reflections.ps1" -ForegroundColor Yellow
    }
    if ($episodeTokens -gt 30000) {
        Write-Host "  → Merge old episodes into quarterly summaries" -ForegroundColor Yellow
    }
    if ($llTokens -gt 3000) {
        Write-Host "  → Archive lessons-learned.md old entries to lessons-learned-archive.md" -ForegroundColor Yellow
    }
    Write-Host "  → Review oversized skills/reflections/episodes and compress/split" -ForegroundColor Yellow
}

Write-Host ""
if ($hasError) {
    Write-Host "Result: WARNING — Memory maintenance recommended" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Result: OK — Memory health is good" -ForegroundColor Green
    exit 0
}
