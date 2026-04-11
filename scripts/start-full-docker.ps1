# AgentHive 全容器化启动脚本
Write-Host "🐳 AgentHive 全容器化启动" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# 检查 Ollama
Write-Host "[1/3] 检查 Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -ErrorAction Stop
    $models = $response.Content | ConvertFrom-Json
    Write-Host "✅ Ollama 运行中，模型: $($models.models[0].name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama 未运行！请先启动: ollama serve" -ForegroundColor Red
    exit 1
}

# 创建环境变量
if (-not (Test-Path .env)) {
    Write-Host "[INFO] 创建 .env 文件..." -ForegroundColor Green
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    @"
DB_PASSWORD=devpassword123
JWT_SECRET=$jwtSecret
"@ | Out-File -FilePath .env -Encoding UTF8
}

# 显示资源预估
Write-Host ""
Write-Host "[2/3] 资源消耗预估:" -ForegroundColor Yellow
Write-Host "  当前容器 (4个):    ~120 MB" -ForegroundColor Gray
Write-Host "  Landing (pnpm):    ~350-600 MB" -ForegroundColor Gray
Write-Host "  全容器化总计:      ~500-750 MB" -ForegroundColor Gray
Write-Host "  磁盘占用增加:      ~2-3 GB (pnpm store)" -ForegroundColor Gray
Write-Host ""

# 启动服务
Write-Host "[3/3] 启动全容器化服务..." -ForegroundColor Yellow
Write-Host "⚠️ 首次启动需要安装 pnpm 和依赖，可能需要 3-5 分钟" -ForegroundColor Yellow
docker compose -f docker-compose.full.yml up -d

# 等待初始化
Write-Host ""
Write-Host "⏳ 等待服务初始化 (首次较慢)..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$landingReady = $false
$apiReady = $false

while ($attempt -lt $maxAttempts) {
    $attempt++
    
    # 检查 landing
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if (-not $landingReady) {
            Write-Host "  ✅ Landing 就绪 (http://localhost:3000)" -ForegroundColor Green
            $landingReady = $true
        }
    } catch {}
    
    # 检查 API
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if (-not $apiReady) {
            Write-Host "  ✅ API 就绪 (http://localhost:3001)" -ForegroundColor Green
            $apiReady = $true
        }
    } catch {}
    
    if ($landingReady -and $apiReady) {
        break
    }
    
    Write-Host "  等待中... ($attempt/$maxAttempts)" -ForegroundColor Gray
    Start-Sleep -Seconds 5
}

# 显示结果
Write-Host ""
Write-Host "==========================" -ForegroundColor Cyan
if ($landingReady -and $apiReady) {
    Write-Host "🎉 全容器化启动成功！" -ForegroundColor Green
    Write-Host "==========================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "访问地址:" -ForegroundColor Yellow
    Write-Host "  🌐 Landing: http://localhost" -ForegroundColor White
    Write-Host "  📡 API:     http://localhost:3001" -ForegroundColor White
    Write-Host "  🔗 Ollama:  http://localhost:11434 (宿主机)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "查看日志:" -ForegroundColor Yellow
    Write-Host "  docker compose -f docker-compose.full.yml logs -f landing" -ForegroundColor Gray
    Write-Host "  docker compose -f docker-compose.full.yml logs -f api" -ForegroundColor Gray
} else {
    Write-Host "⚠️ 部分服务启动较慢，请查看日志:" -ForegroundColor Yellow
    Write-Host "  docker compose -f docker-compose.full.yml logs landing" -ForegroundColor Gray
}
Write-Host ""
Write-Host "停止服务:" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.full.yml down" -ForegroundColor Gray
