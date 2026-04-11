#!/usr/bin/env pwsh
# 构建 Docker 镜像脚本

$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building AgentHive Images" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 进入项目目录
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot\agenthive-cloud

# 构建 API
Write-Host "`n[1/2] Building API image..." -ForegroundColor Yellow
docker build -t agenthive-api:latest -f apps/api/Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Error "API build failed!"
    exit 1
}
Write-Host "�?API image built successfully" -ForegroundColor Green

# 构建 Landing
Write-Host "`n[2/2] Building Landing image..." -ForegroundColor Yellow
docker build -t agenthive-landing:latest -f apps/landing/Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Landing build failed!"
    exit 1
}
Write-Host "�?Landing image built successfully" -ForegroundColor Green

# 显示结果
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
docker images --filter "reference=agenthive*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
Write-Host ""
Write-Host "Test locally:"
Write-Host "  docker run -d -p 3001:3001 --name api agenthive-api:latest"
Write-Host "  docker run -d -p 80:80 --name landing agenthive-landing:latest"
