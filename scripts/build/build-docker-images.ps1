#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build AgentHive Docker Images
.DESCRIPTION
    Build docker images for api and landing
.PARAMETER Registry
    Docker registry URL
.PARAMETER Tag
    Image tag
.PARAMETER Push
    Push to registry
.EXAMPLE
    .\build-docker-images.ps1
    .\build-docker-images.ps1 -Registry "my-registry.com" -Push
#>

param(
    [string]$Registry = "",
    [string]$Tag = "",
    [switch]$Push
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Get tag
if ([string]::IsNullOrEmpty($Tag)) {
    try {
        $Tag = git rev-parse --short HEAD
    } catch {
        $Tag = "latest"
    }
    Write-Info "Using tag: $Tag"
}

# Image names
$ApiImage = if ($Registry) { "$Registry/agenthive-api:$Tag" } else { "agenthive-api:$Tag" }
$LandingImage = if ($Registry) { "$Registry/agenthive-landing:$Tag" } else { "agenthive-landing:$Tag" }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building Docker Images" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not found"
    exit 1
}

docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker not running"
    exit 1
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# Build API
Write-Host ""
Write-Info "Building API: $ApiImage"
docker build -t $ApiImage -f apps/apps/api/Dockerfile.minimal apps
if ($LASTEXITCODE -ne 0) { Write-Error "API build failed"; exit 1 }
Write-Success "API build success"

$ApiLatest = if ($Registry) { "$Registry/agenthive-api:latest" } else { "agenthive-api:latest" }
docker tag $ApiImage $ApiLatest

# Build Landing
Write-Host ""
Write-Info "Building Landing: $LandingImage"
docker build -t $LandingImage -f apps/apps/landing/Dockerfile.minimal apps
if ($LASTEXITCODE -ne 0) { Write-Error "Landing build failed"; exit 1 }
Write-Success "Landing build success"

$LandingLatest = if ($Registry) { "$Registry/agenthive-landing:latest" } else { "agenthive-landing:latest" }
docker tag $LandingImage $LandingLatest

# Push
if ($Push -and $Registry) {
    Write-Host ""
    Write-Info "Pushing images..."
    docker push $ApiImage
    docker push $ApiLatest
    docker push $LandingImage
    docker push $LandingLatest
    Write-Success "Push complete"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "API:     $ApiImage"
Write-Host "Landing: $LandingImage"
Write-Host ""
docker images --filter "reference=*agenthive*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
Write-Host ""
Write-Host "Run:"
Write-Host "  docker run -p 3001:3001 $ApiImage"
Write-Host "  docker run -p 80:80 $LandingImage"
