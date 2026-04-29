#!/usr/bin/env pwsh
# 部署到 Kubernetes 脚本

$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploying to Kubernetes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 检查 K8s 连接
Write-Host "`n[1/6] Checking Kubernetes connection..." -ForegroundColor Yellow
kubectl cluster-info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cannot connect to Kubernetes. Please ensure Docker Desktop K8s is enabled."
    exit 1
}
Write-Host "✓ Connected to K8s" -ForegroundColor Green

# 加载镜像到 K8s（如果使用 Kind）
Write-Host "`n[2/6] Loading images..." -ForegroundColor Yellow
$kindClusters = kind get clusters 2>$null
if ($kindClusters -and $kindClusters -match "agenthive") {
    Write-Host "Kind cluster detected, loading images..."
    kind load docker-image agenthive-api:latest --name agenthive
    kind load docker-image agenthive-landing:latest --name agenthive
} else {
    Write-Host "Using Docker Desktop K8s, images should be available directly"
}
Write-Host "✓ Images ready" -ForegroundColor Green

# 部署
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "`n[3/6] Creating namespace and config..." -ForegroundColor Yellow
kubectl apply -f k8s/base/00-namespace.yaml
kubectl apply -f k8s/base/08-configmap.yaml
# 注意：本地开发若未安装 External Secrets Operator，需手动创建 Secret：
# kubectl create secret generic app-secrets --from-literal=DB_USER=agenthive --from-literal=DB_PASSWORD=dev --from-literal=JWT_SECRET=dev-jwt-secret --from-literal=LLM_API_KEY=sk-your-llm-api-key -n agenthive --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/base/01-secretstore.yaml
kubectl apply -f k8s/base/01-externalsecrets.yaml
Write-Host "✓ Namespace and config created" -ForegroundColor Green

Write-Host "`n[4/6] Deploying databases..." -ForegroundColor Yellow
kubectl apply -f k8s/base/02-postgres.yaml
kubectl apply -f k8s/base/03-redis.yaml
Write-Host "✓ Databases deployed" -ForegroundColor Green

Write-Host "`n[5/6] Deploying applications..." -ForegroundColor Yellow
kubectl apply -f k8s/base/04-api.yaml
kubectl apply -f k8s/base/05-landing.yaml
Write-Host "✓ Applications deployed" -ForegroundColor Green

# 等待就绪
Write-Host "`n[6/6] Waiting for pods to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgres -n agenthive --timeout=120s 2>$null | Out-Null
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n agenthive --timeout=60s 2>$null | Out-Null
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=api -n agenthive --timeout=120s 2>$null | Out-Null
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=landing -n agenthive --timeout=120s 2>$null | Out-Null
Write-Host "✓ All pods are ready" -ForegroundColor Green

# 显示状态
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
kubectl get pods -n agenthive -o wide
Write-Host ""
kubectl get svc -n agenthive
Write-Host ""
Write-Host "Access URLs:"
Write-Host "  Landing: http://localhost"
Write-Host "  API: http://localhost/api"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  kubectl logs -f deployment/api -n agenthive"
Write-Host "  kubectl logs -f deployment/landing -n agenthive"
Write-Host "  kubectl delete -f k8s/base/ to clean up"
