# API 测试脚本

$baseUrl = "http://localhost:3001/api"

function Test-Api {
    param($Method, $Path, $Body)
    
    $url = "$baseUrl$Path"
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "$Method $url" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
    try {
        $params = @{
            Uri = $url
            Method = $Method
            ContentType = "application/json"
        }
        if ($Body) {
            $params.Body = $Body
            Write-Host "Request: $Body" -ForegroundColor Yellow
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "Response:" -ForegroundColor Magenta
        $response | ConvertTo-Json -Depth 5
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}

# 1. 健康检查
Test-Api -Method GET -Path "/health"

# 2. 发送短信验证码
Test-Api -Method POST -Path "/auth/sms/send" -Body '{"phone":"13800138000"}'

# 3. 短信登录 (需要使用上面返回的验证码)
# Test-Api -Method POST -Path "/auth/login/sms" -Body '{"phone":"13800138000","code":"123456"}'

# 4. 用户名密码登录
Test-Api -Method POST -Path "/auth/login" -Body '{"username":"admin","password":"password"}'

# 5. 获取 Agent 列表
Test-Api -Method GET -Path "/agents"

# 6. 获取 Agent 详情
Test-Api -Method GET -Path "/agents/agent-1"

# 7. 创建 Agent
Test-Api -Method POST -Path "/agents" -Body '{"name":"New Agent","role":"frontend_dev","description":"Test agent"}'

# 8. 获取任务列表
Test-Api -Method GET -Path "/tasks"

# 9. 创建任务
Test-Api -Method POST -Path "/tasks" -Body '{"title":"Test Task","type":"feature","priority":"high"}'

# 10. 获取文件列表
Test-Api -Method GET -Path "/code/files"

# 11. 搜索文件
Test-Api -Method GET -Path "/code/search?query=auth"

# 12. 获取示例计划
Test-Api -Method GET -Path "/demo/plan"

Write-Host "`n✅ API 测试完成" -ForegroundColor Green
