#Requires -Version 7
<#
.SYNOPSIS
    AgentHive Cloud — Compress Reflections (Monthly)
    将 .kimi/memory/reflections/ 下的旧 reflection 压缩为月度摘要。

.DESCRIPTION
    运行方式:
      1. 手动: .\scripts\maintenance\compress-reflections.ps1 -Month 2026-04
      2. 自动: GitHub Actions 每月 1 号定时触发
      3. Agent: Lead Agent 收到 /maintenance 指令后执行

    处理逻辑:
      - 读取 reflections/ 下所有 *.md
      - 按月份分组
      - 调用 Kimi CLI 生成月度摘要（high-frequency patterns, insights, mistakes）
      - 将原始文件移入 archive/reflections/YYYY-MM/
      - 保留 summary-YYYY-MM.md

.EXAMPLE
    .\scripts\maintenance\compress-reflections.ps1 -Month 2026-04 -WhatIf
    .\scripts\maintenance\compress-reflections.ps1 -Month 2026-04
#>
param(
    [string]$Month = (Get-Date).AddMonths(-1).ToString("yyyy-MM"),
    [string]$MemoryRoot = ".kimi/memory",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$reflectionDir = "$MemoryRoot/reflections"
$archiveDir = "$MemoryRoot/archive/reflections/$Month"
$summaryFile = "$reflectionDir/summary-$Month.md"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Reflection Compression: $Month" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 收集该月的 reflection 文件
$files = Get-ChildItem -Path $reflectionDir -Filter "*.md" | Where-Object {
    $_.LastWriteTime -ge [datetime]::ParseExact($Month, "yyyy-MM", $null) -and
    $_.LastWriteTime -lt [datetime]::ParseExact($Month, "yyyy-MM", $null).AddMonths(1)
}

if ($files.Count -eq 0) {
    Write-Host "No reflections found for $Month. Nothing to do." -ForegroundColor Green
    exit 0
}

Write-Host "Found $($files.Count) reflections to compress."

# 2. 合并内容（供 Kimi 摘要使用）
$combined = ""
foreach ($f in $files | Sort-Object LastWriteTime) {
    $combined += "`n`n--- $($f.Name) ---`n`n"
    $combined += Get-Content $f.FullName -Raw
}

# 3. 写临时合并文件
$tempFile = [System.IO.Path]::GetTempFileName() + ".md"
Set-Content -Path $tempFile -Value $combined -Encoding UTF8
Write-Host "Combined into temp file: $tempFile ($([math]::Round((Get-Item $tempFile).Length/1KB,1)) KB)"

# 4. 调用 Kimi CLI 生成摘要（如果安装了 kimi）
$kimi = Get-Command "kimi" -ErrorAction SilentlyContinue
if ($kimi) {
    Write-Host "Running Kimi CLI to generate summary..." -ForegroundColor Yellow
    $prompt = @"
你是一位技术文档整理专家。请将以下 $Month 月的 Agent 任务反思记录压缩为一份结构化月度摘要。

要求：
1. High-Frequency Patterns: 出现 3+ 次的模式
2. One-Time Insights: 仅出现 1 次但有价值的洞察
3. Mistakes to Avoid: 需要避免的错误
4. Skill Additions: 建议沉淀为新技能的条目（含文件路径）
5. 每条目 1-2 句话，不要展开细节

输出格式为 Markdown，标题: "# Reflection Summary: $Month"
"@

    if (-not $WhatIf) {
        $summary = & kimi $prompt --file $tempFile 2>$null
        if ($LASTEXITCODE -eq 0 -and $summary) {
            Set-Content -Path $summaryFile -Value $summary -Encoding UTF8
            Write-Host "Summary written: $summaryFile" -ForegroundColor Green
        } else {
            Write-Warning "Kimi CLI failed. Writing placeholder summary."
            $placeholder = "# Reflection Summary: $Month`n`n> Generated on $(Get-Date -Format 'yyyy-MM-dd')`n`n## Files Compressed`n"
            foreach ($f in $files) { $placeholder += "- $($f.Name)`n" }
            $placeholder += "`n## Note`n`n请手动运行 Kimi CLI 生成详细摘要，或编辑此文件补充内容。`n"
            Set-Content -Path $summaryFile -Value $placeholder -Encoding UTF8
        }
    } else {
        Write-Host "[WhatIf] Would generate summary and write to: $summaryFile" -ForegroundColor Cyan
    }
} else {
    Write-Warning "Kimi CLI not found. Please install it or run manually."
    $placeholder = "# Reflection Summary: $Month`n`n> Generated on $(Get-Date -Format 'yyyy-MM-dd')`n`n## Files Compressed`n"
    foreach ($f in $files) { $placeholder += "- $($f.Name)`n" }
    $placeholder += "`n## Note`n`nKimi CLI 未安装。请手动补充摘要内容。`n"
    Set-Content -Path $summaryFile -Value $placeholder -Encoding UTF8
}

# 5. 归档原始文件
if (-not $WhatIf) {
    New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null
    foreach ($f in $files) {
        Move-Item -Path $f.FullName -Destination "$archiveDir/$($f.Name)"
    }
    Write-Host "Archived $($files.Count) files to: $archiveDir" -ForegroundColor Green
} else {
    Write-Host "[WhatIf] Would archive $($files.Count) files to: $archiveDir" -ForegroundColor Cyan
}

# 6. 清理临时文件
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Compression complete." -ForegroundColor Green
