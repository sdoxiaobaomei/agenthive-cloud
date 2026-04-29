# 监控 Landing 初始化进度
Write-Host "⏳ 监控 Landing 初始化..." -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

for ($i = 1; $i -le 60; $i++) {
    $logs = docker logs agenthive-landing --tail 5 2>&1
    
    # 检查是否完成
    if ($logs -match "Nuxt.*ready" -or $logs -match "http://localhost:3000") {
        Write-Host ""
        Write-Host "✅ Landing 启动成功！" -ForegroundColor Green
        Write-Host "访问: http://localhost:3000" -ForegroundColor Cyan
        break
    }
    
    # 检查是否出错
    if ($logs -match "error|Error|ERR_") {
        Write-Host ""
        Write-Host "❌ 发现错误:" -ForegroundColor Red
        $logs | Select-Object -Last 10
        break
    }
    
    # 显示进度
    Write-Host "[$i/60] 初始化中..." -ForegroundColor Yellow
    $lastLine = $logs | Select-Object -Last 1
    if ($lastLine -and $lastLine -notmatch "^\s*$") {
        Write-Host "  > $lastLine" -ForegroundColor Gray
    }
    
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "查看完整日志:" -ForegroundColor Yellow
Write-Host "  docker logs agenthive-landing -f" -ForegroundColor Gray
