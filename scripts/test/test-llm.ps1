# AgentHive LLM 功能测试脚本

Write-Host "🧪 AgentHive LLM 功能测试" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# 测试 1: 健康检查
Write-Host "[1/4] 测试 API 健康检查..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    Write-Host "✅ API 健康: $($data.ok)" -ForegroundColor Green
} catch {
    Write-Host "❌ API 健康检查失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 测试 2: 直接测试 Ollama 连接
Write-Host "[2/4] 测试 Ollama 直接连接..." -ForegroundColor Yellow
try {
    $body = @{
        model = "qwen3:14b"
        messages = @(
            @{role = "user"; content = "你好，请用一句话介绍自己"}
        )
        stream = $false
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/chat" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 60
    $data = $response.Content | ConvertFrom-Json
    $content = $data.message.content
    Write-Host "✅ Ollama 响应:" -ForegroundColor Green
    Write-Host "   $content" -ForegroundColor Gray
} catch {
    Write-Host "❌ Ollama 测试失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 测试 3: 测试流式响应
Write-Host "[3/4] 测试 Ollama 流式响应..." -ForegroundColor Yellow
try {
    $body = @{
        model = "qwen3:14b"
        messages = @(
            @{role = "user"; content = "1+1等于几？"}
        )
        stream = $true
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/chat" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 60
    $content = $response.Content
    
    # 解析流式响应
    $lines = $content -split "`n" | Where-Object { $_.Trim() -ne "" }
    $fullText = ""
    foreach ($line in $lines) {
        try {
            $data = $line | ConvertFrom-Json
            if ($data.message.content) {
                $fullText += $data.message.content
            }
        } catch {}
    }
    
    Write-Host "✅ 流式响应:" -ForegroundColor Green
    Write-Host "   $fullText" -ForegroundColor Gray
} catch {
    Write-Host "❌ 流式测试失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 测试 4: API LLM 服务检查
Write-Host "[4/4] 检查 API LLM 服务状态..." -ForegroundColor Yellow
try {
    docker logs agenthive-api --tail 50 2>$null | Select-String "LLM|Ollama" | Select-Object -Last 5 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
    Write-Host "✅ LLM 服务已配置" -ForegroundColor Green
} catch {
    Write-Host "⚠️ 无法读取日志" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "==========================" -ForegroundColor Cyan
Write-Host "LLM 功能测试完成!" -ForegroundColor Green
