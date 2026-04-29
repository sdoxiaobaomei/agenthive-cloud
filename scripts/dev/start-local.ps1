# AgentHive 本地开发启动脚�?(PowerShell)
# 使用本地 Ollama，其他服务用 Docker

Write-Host "🚀 AgentHive 本地开发环境启�? -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 检�?Ollama
Write-Host "[INFO] 检�?Ollama 服务..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -ErrorAction Stop
    $models = $response.Content | ConvertFrom-Json
    $model = $models.models[0].name
    Write-Host "�?Ollama 运行中，模型: $model" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Ollama 未运行！请先启动 Ollama" -ForegroundColor Red
    Write-Host ""
    Write-Host "启动命令:" -ForegroundColor Yellow
    Write-Host "  Windows: ollama serve"
    exit 1
}

# 生成环境变量
if (-not (Test-Path .env)) {
    Write-Host "[INFO] 生成 .env 配置文件..." -ForegroundColor Green
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    @"
# 本地开发配�?DB_PASSWORD=devpassword123
JWT_SECRET=$jwtSecret

# Ollama 本地配置
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen3:14b
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Host "�?.env 已生�? -ForegroundColor Green
}

# 创建必要的目�?New-Item -ItemType Directory -Force -Path "apps/apps/landing/.output/public" | Out-Null
New-Item -ItemType Directory -Force -Path "nginx/conf.d" | Out-Null

# 检�?Docker
try {
    docker info | Out-Null
} catch {
    Write-Host "[ERROR] Docker 未运行！" -ForegroundColor Red
    exit 1
}

# 启动服务
Write-Host "[INFO] 启动 Docker 服务..." -ForegroundColor Green
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build -d

# 等待服务启动
Write-Host "[INFO] 等待服务初始�?.." -ForegroundColor Green
Start-Sleep -Seconds 5

# 检查服务状�?Write-Host "[INFO] 检查服务状�?.." -ForegroundColor Green
$services = @("agenthive-api", "agenthive-landing", "agenthive-db", "agenthive-redis")
foreach ($service in $services) {
    $running = docker ps --format "{{.Names}}" | Select-String $service
    if ($running) {
        Write-Host "�?$service 运行正常" -ForegroundColor Green
    } else {
        Write-Host "⚠️ $service 可能未正常启�? -ForegroundColor Yellow
    }
}

# 打印访问信息
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "🎉 AgentHive 启动成功�? -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Yellow
Write-Host "  🌐 Landing: http://localhost"
Write-Host "  📡 API:     http://localhost:3001"
Write-Host "  📚 API文档: http://localhost:3001/api/health"
Write-Host ""
Write-Host "LLM 配置:" -ForegroundColor Yellow
Write-Host "  🔗 Ollama:  http://localhost:11434"
Write-Host "  🤖 模型:    qwen3:14b (本地)"
Write-Host ""
Write-Host "常用命令:" -ForegroundColor Yellow
Write-Host "  查看日志:  docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f api"
Write-Host "  停止服务:  docker compose -f docker-compose.dev.yml --env-file .env.dev down"
Write-Host "  重启服务:  docker compose -f docker-compose.dev.yml --env-file .env.dev restart"
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
