#!/usr/bin/env pwsh
<#
.SYNOPSIS
    启动 AgentHive Cloud Dev 环境（完整栈）

.DESCRIPTION
    分步启动策略，避免 Landing 镜像构建超时阻塞整个栈：
    1. 先构建 Landing 镜像（耗时约 2-3 分钟，仅首次）
    2. 再启动完整栈（PostgreSQL + Redis + Nacos + RabbitMQ + Nginx + API + Landing + 7 Java 服务）

.USAGE
    .\scripts\start-dev-with-java.ps1

.NOTES
    - 首次运行需要下载 Landing 的 npm 依赖，请耐心等待
    - Java 服务镜像基于预构建的 target/*.jar，无需额外 Maven 编译
    - Monitoring 栈（Prometheus/Grafana 等）默认不启动，如需启动加 --profile monitoring
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AgentHive Cloud - Dev Stack (Full)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Build Landing image first (avoids compose up timeout)
Write-Host "`n[1/3] Building Landing image..." -ForegroundColor Yellow
Write-Host "    (This may take 2-3 minutes on first run)" -ForegroundColor Gray
docker compose -f docker-compose.dev.yml --env-file .env.dev build landing
if (-not $?) { throw "Landing build failed" }
Write-Host "    Landing image built successfully" -ForegroundColor Green

# Step 2: Start full stack
Write-Host "`n[2/3] Starting full stack..." -ForegroundColor Yellow
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d
if (-not $?) { throw "Stack startup failed" }
Write-Host "    Stack started" -ForegroundColor Green

# Step 3: Health check
Write-Host "`n[3/3] Waiting for services to become healthy..." -ForegroundColor Yellow
$maxWait = 180
$elapsed = 0
while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 5
    $elapsed += 5
    $statuses = docker compose -f docker-compose.dev.yml --env-file .env.dev ps --format "{{.Service}}:{{.Status}}"
    $unhealthy = ($statuses | Select-String -Pattern "unhealthy|Restarting|Exit" | Measure-Object).Count
    if ($unhealthy -eq 0) {
        $healthies = docker compose -f docker-compose.dev.yml --env-file .env.dev ps --format "{{.Status}}"
        $allHealthy = ($healthies | Select-String -Pattern "healthy" | Measure-Object).Count
        # 基础服务(4) + Java(9) + nginx = 14 个有 healthcheck 的服务
        if ($allHealthy -ge 12) {
            Write-Host "    All services are healthy!" -ForegroundColor Green
            break
        }
    }
    Write-Host "    Waiting... ($elapsed s)" -ForegroundColor Gray
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Service Endpoints:" -ForegroundColor Cyan
Write-Host "  Landing:      http://localhost:8088  (Nginx入口)" -ForegroundColor White
Write-Host "  Landing(Direct): http://localhost:3000  (调试用)" -ForegroundColor White
Write-Host "  API:          http://localhost:3001" -ForegroundColor White
Write-Host "  Java Gateway: http://localhost:8080" -ForegroundColor White
Write-Host "  Nacos:        http://localhost:8848/nacos" -ForegroundColor White
Write-Host "  RabbitMQ:     http://localhost:15672" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
