# =============================================================================
# AgentHive Cloud — Dev Environment Health Check (PowerShell)
# TICKET: TICKET-PLAT-DEV-005
# Purpose: Verify all services after `docker compose up` (read-only, safe to rerun)
# Usage  : .\scripts\health-check-dev.ps1
# =============================================================================

#Requires -Version 5.1

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ENV_FILE       = ".env.dev"
$COMPOSE_FILE   = "docker-compose.dev.yml"
$TIMEOUT_SEC    = 5
$MAX_TIME_SEC   = 8

$script:PASS    = 0
$script:FAIL    = 0
$script:WARN    = 0
$script:DIAG    = @()

$Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# --- .env.dev / Compose Config Check ---
Print-Header "Environment & Compose Config"

$composeOutput = docker compose -f $COMPOSE_FILE --env-file $ENV_FILE config 2>&1
$composeWarnings = ($composeOutput | Select-String -Pattern "variable is not set").Count
if ($composeWarnings -eq 0) {
    Print-Row "PASS" ".env.dev loaded" "No unset variables"
} else {
    Print-Row "WARN" ".env.dev loaded" "$composeWarnings unset variable(s)"
    Add-Diagnosis "[.env.dev] $composeWarnings environment variable(s) are not set. Run: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE config 2>&1 | Select-String 'variable is not set'"
}

# --- Load .env.dev if exists ---
if (Test-Path $ENV_FILE) {
    Get-Content $ENV_FILE | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^\s*#') { return }
        if ([string]::IsNullOrWhiteSpace($line)) { return }
        if ($line -match '^(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<val>.*)$') {
            $envVarName = $matches['key']
            $envVarValue = $matches['val'].Trim().Trim("'").Trim('"')
            [Environment]::SetEnvironmentVariable($envVarName, $envVarValue, "Process")
        }
    }
}

# Defaults from docker-compose.dev.yml
$DB_USER            = if ($env:DB_USER)            { $env:DB_USER }            else { "agenthive" }
$DB_PASSWORD        = if ($env:DB_PASSWORD)        { $env:DB_PASSWORD }        else { "dev" }
$DB_NAME            = if ($env:DB_NAME)            { $env:DB_NAME }            else { "agenthive" }
$DB_PORT            = if ($env:DB_PORT)            { $env:DB_PORT }            else { "5433" }
$REDIS_PASSWORD     = if ($env:REDIS_PASSWORD)     { $env:REDIS_PASSWORD }     else { "agenthive" }
$REDIS_PORT         = if ($env:REDIS_PORT)         { $env:REDIS_PORT }         else { "6379" }
$RABBITMQ_USER      = if ($env:RABBITMQ_USER)      { $env:RABBITMQ_USER }      else { "agenthive" }
$RABBITMQ_PASSWORD  = if ($env:RABBITMQ_PASSWORD)  { $env:RABBITMQ_PASSWORD }  else { "agenthive-secret" }
$LANDING_PORT       = if ($env:LANDING_PORT)       { $env:LANDING_PORT }       else { "3000" }
$API_PORT           = if ($env:API_PORT)           { $env:API_PORT }           else { "3001" }
$NACOS_USERNAME     = if ($env:NACOS_USERNAME)     { $env:NACOS_USERNAME }     else { "agenthive" }
$NACOS_PASSWORD     = if ($env:NACOS_PASSWORD)     { $env:NACOS_PASSWORD }     else { "agenthive-secret-2024" }

# --- Helpers ---
function Print-Header([string]$Title) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Print-Row([string]$Status, [string]$Item, [string]$Detail) {
    $padded = $Item.PadRight(28)
    if ($Status -eq "PASS") {
        Write-Host "  ✅  $padded $Detail" -ForegroundColor Green
        $script:PASS++
    }
    elseif ($Status -eq "FAIL") {
        Write-Host "  ❌  $padded $Detail" -ForegroundColor Red
        $script:FAIL++
    }
    else {
        Write-Host "  ⚠️  $padded $Detail" -ForegroundColor Yellow
        $script:WARN++
    }
}

function Add-Diagnosis([string]$Message) {
    $script:DIAG += $Message
}

# --- Pre-flight: Docker ---
$dockerAvailable = $false
$dockerRunning   = $false

try {
    $null = Get-Command docker -ErrorAction Stop
    $dockerAvailable = $true
} catch {
    Print-Header "Docker not found"
    Write-Host "Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
}

try {
    $null = docker info 2>$null
    $dockerRunning = $true
} catch {
    Print-Header "Docker daemon not running"
    Write-Host "Docker daemon is not running." -ForegroundColor Red
    Write-Host "  Windows: Start Docker Desktop"
    Write-Host "  Linux  : sudo systemctl start docker"
    Write-Host "  macOS  : open -a Docker"
    Add-Diagnosis "Docker daemon not running"
}

# --- Container Status ---
Print-Header "Container Status"

$Services = @(
    @{ Name = "postgres";        Container = "agenthive-postgres-dev" },
    @{ Name = "redis";           Container = "agenthive-redis-dev" },
    @{ Name = "nacos";           Container = "agenthive-nacos-dev" },
    @{ Name = "rabbitmq";        Container = "agenthive-rabbitmq-dev" },
    @{ Name = "api";             Container = "agenthive-api-dev" },
    @{ Name = "landing";         Container = "agenthive-landing-dev" },
    @{ Name = "gateway-service"; Container = "agenthive-gateway-dev" },
    @{ Name = "auth-service";    Container = "agenthive-auth-dev" },
    @{ Name = "user-service";    Container = "agenthive-user-dev" },
    @{ Name = "payment-service"; Container = "agenthive-payment-dev" },
    @{ Name = "order-service";   Container = "agenthive-order-dev" },
    @{ Name = "cart-service";    Container = "agenthive-cart-dev" },
    @{ Name = "logistics-service"; Container = "agenthive-logistics-dev" },
    @{ Name = "nginx";             Container = "agenthive-nginx-dev" }
)

$DockerList = @()
if ($dockerRunning) {
    $DockerList = docker ps --format '{{.Names}}|{{.State}}' 2>$null
}

foreach ($svc in $Services) {
    $pattern = "^$($svc.Container)\|"
    $match = $DockerList | Select-String -Pattern $pattern
    if ($match) {
        $parts = $match.Line -split '\|'
        $state = $parts[1]
        if ($state -eq "running") {
            Print-Row "PASS" $svc.Name "$($svc.Container) running"
        } else {
            Print-Row "FAIL" $svc.Name "$($svc.Container) state: $state"
            Add-Diagnosis "[$($svc.Name)] Container is '$state' (not running). Fix: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d $($svc.Name)"
        }
    } else {
        Print-Row "FAIL" $svc.Name "$($svc.Container) not found"
        Add-Diagnosis "[$($svc.Name)] Container not found. Fix: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d $($svc.Name)"
    }
}

# --- HTTP Health Checks ---
Print-Header "Service Health Endpoints"

function Test-HealthEndpoint([string]$Name, [string]$Url, [string]$Container) {
    try {
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec $MAX_TIME_SEC -UseBasicParsing -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            Print-Row "PASS" $Name "HTTP 200"
        } else {
            Print-Row "WARN" $Name "HTTP $($resp.StatusCode)"
            Add-Diagnosis "[$Name] Unexpected HTTP $($resp.StatusCode). Fix: docker logs $Container"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 503) {
            Print-Row "WARN" $Name "HTTP 503 (degraded)"
            Add-Diagnosis "[$Name] Service is up but reporting degraded (HTTP 503). Fix: docker logs $Container"
        } else {
            $code = if ($statusCode) { $statusCode } else { "000" }
            Print-Row "FAIL" $Name "HTTP $code"
            Add-Diagnosis "[$Name] Health endpoint returned HTTP $code. Fix: docker logs $Container"
        }
    }
}

Test-HealthEndpoint "Gateway"   "http://localhost:8080/actuator/health" "agenthive-gateway-dev"
Test-HealthEndpoint "Auth"      "http://localhost:8081/actuator/health" "agenthive-auth-dev"
Test-HealthEndpoint "User"      "http://localhost:8082/actuator/health" "agenthive-user-dev"
Test-HealthEndpoint "Payment"   "http://localhost:8083/actuator/health" "agenthive-payment-dev"
Test-HealthEndpoint "Order"     "http://localhost:8084/actuator/health" "agenthive-order-dev"
Test-HealthEndpoint "Cart"      "http://localhost:8085/actuator/health" "agenthive-cart-dev"
Test-HealthEndpoint "Logistics" "http://localhost:8086/actuator/health" "agenthive-logistics-dev"
Test-HealthEndpoint "Node API"  "http://localhost:$API_PORT/api/health" "agenthive-api-dev"
Test-HealthEndpoint "API /me"   "http://localhost:$API_PORT/api/me"    "agenthive-api-dev"
Test-HealthEndpoint "Landing"   "http://localhost:$LANDING_PORT"        "agenthive-landing-dev"

# --- Database Checks ---
Print-Header "PostgreSQL Databases"

function Test-Database([string]$Name, [string]$DbName) {
    $cmd = "docker exec -e PGPASSWORD=`"$DB_PASSWORD`" agenthive-postgres-dev psql -U `"$DB_USER`" -d `"$DbName`" -c 'SELECT 1'"
    $null = Invoke-Expression $cmd 2>$null
    if ($LASTEXITCODE -eq 0) {
        Print-Row "PASS" "$Name DB" "$DbName OK"
    } else {
        Print-Row "FAIL" "$Name DB" "$DbName connection failed"
        Add-Diagnosis "[$Name DB] psql connection failed. Fix: docker logs agenthive-postgres-dev"
    }
}

Test-Database "Main"      $DB_NAME
Test-Database "Auth"      "auth_db"
Test-Database "User"      "user_db"
Test-Database "Payment"   "payment_db"
Test-Database "Order"     "order_db"
Test-Database "Cart"      "cart_db"
Test-Database "Logistics" "logistics_db"

# --- Redis ---
Print-Header "Redis"

$redisOut = docker exec agenthive-redis-dev redis-cli -a $REDIS_PASSWORD ping 2>$null
if ($redisOut -eq "PONG") {
    Print-Row "PASS" "Redis" "PONG"
} else {
    $display = if ($redisOut) { $redisOut } else { "no response" }
    Print-Row "FAIL" "Redis" "No PONG (response: $display)"
    Add-Diagnosis "[Redis] redis-cli ping failed. Fix: docker logs agenthive-redis-dev"
}

# --- Nacos Service Registry ---
Print-Header "Nacos Service Registry"

try {
    $loginBody = "username=$NACOS_USERNAME&password=$NACOS_PASSWORD"
    $loginResp = Invoke-WebRequest -Uri "http://localhost:8848/nacos/v1/auth/login" -Method POST -Body $loginBody -TimeoutSec $TIMEOUT_SEC -UseBasicParsing -ErrorAction Stop
    $loginJson = $loginResp.Content | ConvertFrom-Json
    $nacosToken = $loginJson.accessToken
} catch {
    $nacosToken = $null
}

$nacosUrl = "http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=10"
if ($nacosToken) {
    $nacosUrl += "&accessToken=$nacosToken"
}

try {
    $nacosResp = Invoke-WebRequest -Uri $nacosUrl -TimeoutSec $MAX_TIME_SEC -UseBasicParsing -ErrorAction Stop
    Print-Row "PASS" "Nacos API" "HTTP $($nacosResp.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $displayCode = if ($code) { $code } else { "000" }
    Print-Row "FAIL" "Nacos API" "HTTP $displayCode"
    Add-Diagnosis "[Nacos] Service list API returned HTTP $displayCode. Fix: docker logs agenthive-nacos-dev"
}

# Check individual Java services registered in Nacos
$NacosServices = @("gateway-service", "auth-service", "user-service", "payment-service", "order-service", "cart-service", "logistics-service")
foreach ($svc in $NacosServices) {
    $svcUrl = "http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=10&serviceName=$svc"
    if ($nacosToken) {
        $svcUrl += "&accessToken=$nacosToken"
    }
    try {
        $svcResp = Invoke-WebRequest -Uri $svcUrl -TimeoutSec $MAX_TIME_SEC -UseBasicParsing -ErrorAction Stop
        Print-Row "PASS" "Nacos: $svc" "registered"
    } catch {
        $svcCode = $_.Exception.Response.StatusCode.value__
        $displaySvcCode = if ($svcCode) { $svcCode } else { "000" }
        Print-Row "FAIL" "Nacos: $svc" "not registered (HTTP $displaySvcCode)"
        $fixName = $svc -replace "-service",""
        Add-Diagnosis "[Nacos: $svc] Service not registered. Fix: docker logs agenthive-$fixName-dev"
    }
}

# --- RabbitMQ ---
Print-Header "RabbitMQ Management"

$pair = "$($RABBITMQ_USER):$($RABBITMQ_PASSWORD)"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [Convert]::ToBase64String($bytes)
$headers = @{ Authorization = "Basic $base64" }

try {
    $rmqResp = Invoke-WebRequest -Uri "http://localhost:15672/api/overview" -Headers $headers -TimeoutSec $MAX_TIME_SEC -UseBasicParsing -ErrorAction Stop
    Print-Row "PASS" "RabbitMQ" "HTTP $($rmqResp.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $displayCode = if ($code) { $code } else { "000" }
    Print-Row "FAIL" "RabbitMQ" "HTTP $displayCode"
    Add-Diagnosis "[RabbitMQ] Management API returned HTTP $displayCode. Fix: docker logs agenthive-rabbitmq-dev"
}

# --- Summary ---
Print-Header "Health Check Summary"

$elapsed = [math]::Round($Stopwatch.Elapsed.TotalSeconds, 1)
$total = $script:PASS + $script:FAIL + $script:WARN

Write-Host "  Total checks:       $total"
Write-Host "  Passed:             $($script:PASS)"  -ForegroundColor Green
Write-Host "  Failed:             $($script:FAIL)"  -ForegroundColor Red
Write-Host "  Warnings:           $($script:WARN)"  -ForegroundColor Yellow
Write-Host "  Execution time:     ${elapsed}s"

if ($script:DIAG.Count -gt 0) {
    Write-Host ""
    Write-Host "Diagnosis & Suggested Fixes" -ForegroundColor Cyan
    Write-Host "───────────────────────────────────────────────────────────────" -ForegroundColor Cyan
    foreach ($item in $script:DIAG) {
        Write-Host "  • $item" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($script:FAIL -eq 0 -and $script:WARN -eq 0) {
    Write-Host "All checks passed! Dev environment is healthy." -ForegroundColor Green
    exit 0
} elseif ($script:FAIL -eq 0) {
    Write-Host "Dev environment is functional with warnings." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "Dev environment has failures. Review diagnosis above." -ForegroundColor Red
    exit 1
}
