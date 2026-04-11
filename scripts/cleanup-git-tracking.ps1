# Git 仓库清理脚本
# 从 Git 追踪中移除不必要的文件（保留本地文件）

Write-Host "🧹 Git 仓库清理脚本" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""

# 检查是否在 git 仓库中
if (-not (Test-Path ".git")) {
    Write-Host "❌ 错误: 当前目录不是 Git 仓库" -ForegroundColor Red
    exit 1
}

# 要从追踪中移除的文件/目录
$itemsToRemove = @(
    # IDE 配置
    ".continue",
    ".trae",
    ".vscode",
    ".playwright-mcp",
    
    # 依赖目录
    "node_modules",
    
    # 临时文件
    "atom_ex1.html",
    "atom_ex1_files",
    "example.html",
    "landing-fixed.png",
    "landing-page.png",
    "web-app.png",
    "test_task.json",
    
    # 其他
    "package-lock.json",
    ".env"
)

Write-Host "📋 将从 Git 追踪中移除以下项目:" -ForegroundColor Yellow
foreach ($item in $itemsToRemove) {
    if (Test-Path $item) {
        Write-Host "  - $item" -ForegroundColor Cyan
    }
}
Write-Host ""

$confirm = Read-Host "确认执行? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "已取消" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🚀 开始清理..." -ForegroundColor Green
Write-Host ""

$removedCount = 0
$failedItems = @()

foreach ($item in $itemsToRemove) {
    if (Test-Path $item) {
        Write-Host "移除: $item" -NoNewline
        try {
            if ((Get-Item $item) -is [System.IO.DirectoryInfo]) {
                git rm -r --cached $item 2>$null
            } else {
                git rm --cached $item 2>$null
            }
            Write-Host " ✓" -ForegroundColor Green
            $removedCount++
        } catch {
            Write-Host " ✗" -ForegroundColor Red
            $failedItems += $item
        }
    }
}

Write-Host ""
Write-Host "📊 清理完成" -ForegroundColor Green
Write-Host "移除项目数: $removedCount" -ForegroundColor Cyan

if ($failedItems.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  以下项目移除失败:" -ForegroundColor Yellow
    foreach ($item in $failedItems) {
        Write-Host "  - $item" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📌 下一步操作:" -ForegroundColor Yellow
Write-Host "  1. 检查状态: git status" -ForegroundColor White
Write-Host "  2. 提交更改: git add -A && git commit -m 'chore: 清理不必要的文件'" -ForegroundColor White
Write-Host "  3. 推送: git push origin main" -ForegroundColor White
Write-Host ""
Write-Host "💡 提示: .gitignore 已更新，防止这些文件再次被提交" -ForegroundColor Cyan
