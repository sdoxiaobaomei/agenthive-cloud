# Git 清理脚本 - 移除不应该被跟踪的文件 (PowerShell)

Write-Host "🧹 开始清理 Git 仓库..." -ForegroundColor Cyan

# 检查是否在 git 仓库中
$gitDir = git rev-parse --git-dir 2>$null
if (-not $gitDir) {
    Write-Host "❌ 错误：当前目录不是 Git 仓库" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 当前 Git 状态：" -ForegroundColor Yellow
git status --short | Select-Object -First 20

Write-Host "`n🗑️  移除已跟踪的日志和二进制文件..." -ForegroundColor Yellow

# 移除日志文件
$filesToRemove = @(
    "apps/supervisor/supervisor.err",
    "apps/supervisor/supervisor.log",
    "apps/web/dev.err",
    "apps/web/dev.log",
    "apps/web/vite.err",
    "apps/web/vite.log"
)

$trackedFiles = git ls-files

foreach ($file in $filesToRemove) {
    if ($trackedFiles -contains $file) {
        Write-Host "  移除: $file"
        git rm --cached $file 2>$null
    }
}

# 移除二进制文件
if ($trackedFiles -contains "apps/supervisor/supervisor.exe") {
    Write-Host "  移除: apps/supervisor/supervisor.exe"
    git rm --cached "apps/supervisor/supervisor.exe" 2>$null
}

Write-Host "`n📝 更新 .gitignore..." -ForegroundColor Yellow
git add .gitignore
git add apps/web/.gitignore
git add apps/supervisor/.gitignore

Write-Host "`n✅ 清理完成！" -ForegroundColor Green
Write-Host "`n请检查以下未跟踪文件，决定是否添加到仓库："
Write-Host "git status" -ForegroundColor Yellow
Write-Host "`n提交更改："
Write-Host "git commit -m `"chore: cleanup git tracking and update .gitignore`"" -ForegroundColor Yellow
