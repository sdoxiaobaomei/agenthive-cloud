#Requires -Version 7
<#
.SYNOPSIS
    AgentHive Cloud — Review Skills (Quarterly)
    审查 .kimi/memory/skills/ 下的所有技能，决定晋升/降级/淘汰。

.DESCRIPTION
    运行方式:
      1. 手动: .\scripts\maintenance\review-skills.ps1
      2. 自动: GitHub Actions 每季度第一天触发
      3. Agent: Lead Agent 收到 /maintenance 指令后执行

    审查规则:
      - draft/ 中 30+ 天未晋升 → 建议删除
      - official/ 中 90+ 天零引用 → 建议降级
      - retired/ 中 180+ 天 → 建议删除
      - 与现有 skill 重复 → 建议合并

.EXAMPLE
    .\scripts\maintenance\review-skills.ps1 -WhatIf
    .\scripts\maintenance\review-skills.ps1
#>
param(
    [string]$MemoryRoot = ".kimi/memory",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$roles = @("java", "node", "frontend", "platform")
$now = Get-Date
$report = @()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Skill Review Report" -ForegroundColor Cyan
Write-Host "Date: $($now.ToString('yyyy-MM-dd'))" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($role in $roles) {
    Write-Host ""
    Write-Host "--- Role: $role ---" -ForegroundColor Yellow

    $skillBase = "$MemoryRoot/skills/$role"
    if (-not (Test-Path $skillBase)) { continue }

    # 1. 检查 draft/ 中过期文件
    $draftDir = "$skillBase/draft"
    if (Test-Path $draftDir) {
        $draftFiles = Get-ChildItem -Path $draftDir -Recurse -Filter "*.md" -ErrorAction SilentlyContinue
        foreach ($f in $draftFiles) {
            $ageDays = ($now - $f.LastWriteTime).Days
            if ($ageDays -gt 30) {
                $report += [PSCustomObject]@{
                    Role = $role
                    File = $f.FullName.Replace($PWD.Path + "\", "")
                    AgeDays = $ageDays
                    Action = "DELETE"
                    Reason = "Draft expired ($ageDays days > 30)"
                }
                Write-Host "  [DELETE] $($f.Name) — Draft expired ($ageDays days)" -ForegroundColor Red
            }
        }
    }

    # 2. 检查 official/ 中冷门文件（通过 git log 统计引用）
    $officialDir = "$skillBase/official"
    if (Test-Path $officialDir) {
        $officialFiles = Get-ChildItem -Path $officialDir -Recurse -Filter "*.md" -ErrorAction SilentlyContinue
        foreach ($f in $officialFiles) {
            # 简化的"引用计数": 检查 reflections/ 中是否有文件提到这个 skill
            $skillName = $f.BaseName
            $references = 0
            $refDir = "$MemoryRoot/reflections"
            if (Test-Path $refDir) {
                $references = (Select-String -Path "$refDir/*.md" -Pattern $skillName -ErrorAction SilentlyContinue).Count
            }
            # 也检查 episodes/
            $epDir = "$MemoryRoot/episodes"
            if (Test-Path $epDir) {
                $references += (Select-String -Path "$epDir/*.md" -Pattern $skillName -ErrorAction SilentlyContinue).Count
            }

            $ageDays = ($now - $f.LastWriteTime).Days
            if ($ageDays -gt 90 -and $references -eq 0) {
                $report += [PSCustomObject]@{
                    Role = $role
                    File = $f.FullName.Replace($PWD.Path + "\", "")
                    AgeDays = $ageDays
                    Action = "DEMOTE"
                    Reason = "No references in 90+ days"
                }
                Write-Host "  [DEMOTE] $($f.Name) — No references in $ageDays days" -ForegroundColor Magenta
            }
        }
    }

    # 3. 检查 retired/ 中可删除文件
    $retiredDir = "$skillBase/retired"
    if (Test-Path $retiredDir) {
        $retiredFiles = Get-ChildItem -Path $retiredDir -Recurse -Filter "*.md" -ErrorAction SilentlyContinue
        foreach ($f in $retiredFiles) {
            $ageDays = ($now - $f.LastWriteTime).Days
            if ($ageDays -gt 180) {
                $report += [PSCustomObject]@{
                    Role = $role
                    File = $f.FullName.Replace($PWD.Path + "\", "")
                    AgeDays = $ageDays
                    Action = "DELETE"
                    Reason = "Retired skill expired ($ageDays days > 180)"
                }
                Write-Host "  [DELETE] $($f.Name) — Retired expired ($ageDays days)" -ForegroundColor Red
            }
        }
    }
}

# 4. 输出报告
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Review Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($report.Count -eq 0) {
    Write-Host "All skills are healthy. No action needed." -ForegroundColor Green
} else {
    Write-Host "Found $($report.Count) items requiring attention:" -ForegroundColor Yellow
    $report | Format-Table -AutoSize

    if (-not $WhatIf) {
        Write-Host ""
        Write-Host "Apply changes? This will move/delete files. (y/N)" -ForegroundColor Red -NoNewline
        $confirm = Read-Host
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            foreach ($item in $report) {
                $src = $item.File
                $dir = Split-Path $src
                $name = Split-Path $src -Leaf
                switch ($item.Action) {
                    "DELETE" {
                        Remove-Item $src -Force
                        Write-Host "  Deleted: $src" -ForegroundColor DarkGray
                    }
                    "DEMOTE" {
                        $destDir = $dir.Replace("official", "draft")
                        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
                        Move-Item $src "$destDir/$name" -Force
                        Write-Host "  Demoted: $src → $destDir/$name" -ForegroundColor DarkGray
                    }
                }
            }
            Write-Host "Changes applied." -ForegroundColor Green
        } else {
            Write-Host "Aborted. No changes made." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WhatIf] No changes applied." -ForegroundColor Cyan
    }
}
