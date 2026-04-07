# Start API Server in Mock Mode
$ErrorActionPreference = "Continue"

cd E:\Git\ai-digital-twin\agenthive-cloud\apps\api

Write-Host "🚀 Starting AgentHive API Server (Mock Mode)..." -ForegroundColor Green
Write-Host ""

# Start the server
$env:NODE_ENV = "development"
npx tsx watch src/index.ts &

$serverJob = $global:LASTEXITCODE

Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if server is running
$retry = 0
$maxRetries = 10

while ($retry -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 3
        Write-Host ""
        Write-Host "✅ API Server is RUNNING!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
        Write-Host "   API: http://localhost:3001/api" -ForegroundColor Gray
        Write-Host "   Health: http://localhost:3001/api/health" -ForegroundColor Gray
        Write-Host "   Demo: http://localhost:3001/api/demo/agents" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📊 Server Status:" -ForegroundColor Cyan
        Write-Host "   Database: Mock (in-memory)" -ForegroundColor Yellow
        Write-Host "   Redis: Disabled" -ForegroundColor Yellow
        Write-Host "   WebSocket: Disabled" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Magenta
        exit 0
    } catch {
        $retry++
        Write-Host "   Waiting... ($retry/$maxRetries)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "❌ Server failed to start properly" -ForegroundColor Red
