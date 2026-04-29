<#
.SYNOPSIS
    Dev Environment Auto-Build & Acceptance Script for AgentHive Cloud.

.DESCRIPTION
    Automatically detects changed services from the last Git commit,
    rebuilds affected services, and runs health checks.

.PARAMETER All
    Force rebuild all services.

.PARAMETER Services
    Rebuild specific services by name.

.EXAMPLE
    .\scripts\dev-acceptance.ps1
    .\scripts\dev-acceptance.ps1 -All
    .\scripts\dev-acceptance.ps1 -Services @("api", "landing")
#>
[CmdletBinding()]
param(
    [switch]$All,
    [string[]]$Services = @()
)

#Requires -Version 5.1

$ErrorActionPreference = "Stop"
$ComposeFile = "docker-compose.dev.yml"
$EnvFile     = ".env.dev"
$MaxHealthWait = 120
$PollInterval  = 5

# =============================================================================
# Configuration
# =============================================================================

$script:AllKnownServices = @(
    # Infrastructure first
    "postgres", "redis", "nacos", "rabbitmq", "otel-collector",
    # Node.js services
    "api", "landing",
    # Java microservices
    "gateway-service", "auth-service", "user-service",
    "payment-service", "order-service", "cart-service", "logistics-service",
    # Reverse proxy
    "nginx"
)

$script:HealthEndpoints = @{
    "api"               = "http://localhost:3001/api/health"
    "landing"           = "http://localhost:3000"
    "gateway-service"   = "http://localhost:8080/actuator/health"
    "auth-service"      = "http://localhost:8081/actuator/health"
    "user-service"      = "http://localhost:8082/actuator/health"
    "payment-service"   = "http://localhost:8083/actuator/health"
    "order-service"     = "http://localhost:8084/actuator/health"
    "cart-service"      = "http://localhost:8085/actuator/health"
    "logistics-service" = "http://localhost:8086/actuator/health"
    "nginx"             = "http://localhost:8088"
}

$script:ServicePathMap = [ordered]@{
    "apps/landing/"       = "landing"
    "apps/api/"           = "api"
    "apps/java/gateway"   = "gateway-service"
    "apps/java/auth"      = "auth-service"
    "apps/java/user"      = "user-service"
    "apps/java/order"     = "order-service"
    "apps/java/payment"   = "payment-service"
    "apps/java/cart"      = "cart-service"
    "apps/java/logistics" = "logistics-service"
    "docker/"             = "ALL"
    "docker-compose"      = "ALL"
    "nginx/"              = "nginx"
}

# =============================================================================
# Helpers
# =============================================================================

function Test-DockerRunning {
    try {
        $null = Get-Command docker -ErrorAction Stop
    } catch {
        Write-Host "❌ Docker is not installed or not in PATH." -ForegroundColor Red
        Write-Host "   Install Docker Desktop: https://docs.docker.com/get-docker/"
        exit 1
    }
    try {
        $null = docker info 2>$null
        Write-Host "✅ Docker is running." -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker daemon is not running." -ForegroundColor Red
        Write-Host "   Windows: Start Docker Desktop and wait for the engine to start."
        exit 1
    }
}

function Get-ComposeServiceStatus {
    param([string]$ServiceName)

    $output = docker compose -f $ComposeFile --env-file $EnvFile ps --format json $ServiceName 2>$null
    if ([string]::IsNullOrWhiteSpace($output)) {
        return $null
    }

    $entries = [System.Collections.Generic.List[object]]::new()

    # Docker Compose v2 outputs NDJSON (one object per line)
    foreach ($line in ($output -split "`r?`n")) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
        try {
            $obj = $trimmed | ConvertFrom-Json -ErrorAction Stop
            $entries.Add($obj)
        } catch {
            # ignore unparseable lines
        }
    }

    if ($entries.Count -eq 0) {
        # Fallback: try parsing the whole output as a single JSON object/array
        try {
            $obj = $output | ConvertFrom-Json -ErrorAction Stop
            if ($obj -is [array]) {
                $entries.AddRange($obj)
            } else {
                $entries.Add($obj)
            }
        } catch {
            return $null
        }
    }

    $match = $entries | Where-Object { $_.Service -eq $ServiceName } | Select-Object -First 1
    if (-not $match) {
        $match = $entries | Where-Object { $_.Name -like "*$ServiceName*" } | Select-Object -First 1
    }
    return $match
}

function Get-AffectedServices {
    if ($All) {
        Write-Host "🔁 Force rebuild ALL services." -ForegroundColor Cyan
        return $script:AllKnownServices
    }

    if ($Services.Count -gt 0) {
        $invalid = $Services | Where-Object { $_ -notin $script:AllKnownServices }
        if ($invalid) {
            throw "Unknown services specified: $($invalid -join ', '). Valid services: $($script:AllKnownServices -join ', ')"
        }
        Write-Host "🔁 Rebuilding specified services: $($Services -join ', ')" -ForegroundColor Cyan
        return $Services
    }

    Write-Host "🔍 Detecting changed services from last commit..." -ForegroundColor Cyan
    $changedFiles = git diff HEAD~1 --name-only 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Git diff failed (first commit or not a git repo?). Rebuilding all services."
        return $script:AllKnownServices
    }

    $affected = [System.Collections.Generic.HashSet[string]]::new()
    $rebuildAll = $false

    foreach ($file in ($changedFiles -split "`r?`n")) {
        $file = $file.Trim()
        if ([string]::IsNullOrWhiteSpace($file)) { continue }

        foreach ($pattern in $script:ServicePathMap.Keys) {
            if ($file.StartsWith($pattern, [System.StringComparison]::OrdinalIgnoreCase)) {
                $svc = $script:ServicePathMap[$pattern]
                if ($svc -eq "ALL") {
                    $rebuildAll = $true
                    break
                } else {
                    [void]$affected.Add($svc)
                }
            }
        }
        if ($rebuildAll) { break }
    }

    if ($rebuildAll) {
        Write-Host "   Shared infrastructure or compose file changed → rebuilding ALL services." -ForegroundColor Yellow
        return $script:AllKnownServices
    }

    $ordered = $script:AllKnownServices | Where-Object { $affected.Contains($_) }
    if ($ordered.Count -eq 0) {
        Write-Host "   No service changes detected." -ForegroundColor Green
    } else {
        Write-Host "   Affected services: $($ordered -join ', ')" -ForegroundColor Green
    }
    return $ordered
}

function Invoke-ServiceBuild {
    param([string]$ServiceName)

    Write-Host ""
    Write-Host "🔨 [$ServiceName] Building image..." -ForegroundColor Yellow
    docker compose -f $ComposeFile --env-file $EnvFile build $ServiceName
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed for service: $ServiceName"
    }

    Write-Host "🚀 [$ServiceName] Starting container..." -ForegroundColor Yellow
    docker compose -f $ComposeFile --env-file $EnvFile up -d $ServiceName
    if ($LASTEXITCODE -ne 0) {
        throw "Docker up failed for service: $ServiceName"
    }
}

function Wait-ServiceHealthy {
    param([string]$ServiceName)

    $elapsed = 0
    $healthy = $false
    $lastHealth = "unknown"

    while ($elapsed -lt $MaxHealthWait) {
        $status = Get-ComposeServiceStatus -ServiceName $ServiceName

        if (-not $status) {
            $lastHealth = "container not found"
        } elseif ($status.State -ne "running") {
            $lastHealth = "state: $($status.State)"
            if ($status.State -eq "exited") {
                break
            }
        } elseif ($status.Health -eq "healthy") {
            $healthy = $true
            $lastHealth = "healthy"
            break
        } elseif ($status.Health -eq "unhealthy") {
            $lastHealth = "unhealthy"
        } else {
            # Health is starting, empty, or null
            $lastHealth = "starting"

            # Fallback to HTTP probe for services without Docker healthcheck
            if ($script:HealthEndpoints.ContainsKey($ServiceName)) {
                try {
                    $resp = Invoke-WebRequest -Uri $script:HealthEndpoints[$ServiceName] `
                        -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
                    if ($resp.StatusCode -eq 200) {
                        $healthy = $true
                        $lastHealth = "healthy (HTTP)"
                        break
                    }
                } catch {
                    $lastHealth = "HTTP probe failed"
                }
            }
        }

        Start-Sleep -Seconds $PollInterval
        $elapsed += $PollInterval
    }

    return [PSCustomObject]@{
        Service    = $ServiceName
        Healthy    = $healthy
        LastHealth = $lastHealth
        Elapsed    = $elapsed
    }
}

function Write-SummaryReport {
    param(
        [string[]]$Affected,
        [array]$HealthResults,
        [double]$TotalSeconds
    )

    $rows = foreach ($svc in $script:AllKnownServices) {
        $action = if ($Affected -contains $svc) { "rebuilt" } else { "skipped" }
        $build  = if ($Affected -contains $svc) { "✅ OK" } else { "—" }
        $h = $HealthResults | Where-Object { $_.Service -eq $svc } | Select-Object -First 1
        $health = if ($h.Healthy) { "✅ UP" } else { "❌ DOWN" }
        $url = if ($script:HealthEndpoints.ContainsKey($svc)) { $script:HealthEndpoints[$svc] } else { "" }

        [PSCustomObject]@{
            Service = $svc
            Action  = $action
            Build   = $build
            Health  = $health
            URL     = $url
        }
    }

    $wSvc = [Math]::Max(7, ($rows | ForEach-Object { $_.Service.Length } | Measure-Object -Maximum).Maximum) + 2
    $wAct = [Math]::Max(6, ($rows | ForEach-Object { $_.Action.Length }  | Measure-Object -Maximum).Maximum) + 2
    $wBld = [Math]::Max(6, ($rows | ForEach-Object { $_.Build.Length }   | Measure-Object -Maximum).Maximum) + 2
    $wHlt = [Math]::Max(6, ($rows | ForEach-Object { $_.Health.Length }  | Measure-Object -Maximum).Maximum) + 2
    $wUrl = [Math]::Max(3, ($rows | ForEach-Object { $_.URL.Length }     | Measure-Object -Maximum).Maximum) + 2

    $header = "║ " + "Service".PadRight($wSvc - 1) + "║ " + "Action".PadRight($wAct - 1) + "║ " + "Build".PadRight($wBld - 1) + "║ " + "Health".PadRight($wHlt - 1) + "║ " + "URL".PadRight($wUrl - 1) + "║"
    $totalW = $header.Length

    $top = "╔" + ("═" * $wSvc) + "╦" + ("═" * $wAct) + "╦" + ("═" * $wBld) + "╦" + ("═" * $wHlt) + "╦" + ("═" * $wUrl) + "╗"
    $mid = "╠" + ("═" * $wSvc) + "╬" + ("═" * $wAct) + "╬" + ("═" * $wBld) + "╬" + ("═" * $wHlt) + "╬" + ("═" * $wUrl) + "╣"
    $bot = "╚" + ("═" * $wSvc) + "╩" + ("═" * $wAct) + "╩" + ("═" * $wBld) + "╩" + ("═" * $wHlt) + "╩" + ("═" * $wUrl) + "╝"

    $title = "Dev Environment Acceptance Report"
    $titlePadded = $title.PadLeft([int](($totalW - 2 + $title.Length) / 2)).PadRight($totalW - 2)
    $titleLine = "║$titlePadded║"

    Write-Host ""
    Write-Host $top
    Write-Host $titleLine
    Write-Host $mid
    Write-Host $header
    Write-Host $mid

    foreach ($r in $rows) {
        Write-Host ("║ " + $r.Service.PadRight($wSvc - 1) + "║ " + $r.Action.PadRight($wAct - 1) + "║ " + $r.Build.PadRight($wBld - 1) + "║ " + $r.Health.PadRight($wHlt - 1) + "║ " + $r.URL.PadRight($wUrl - 1) + "║")
    }

    Write-Host $bot
    Write-Host ""
    Write-Host "Total time: ${TotalSeconds}s"

    $allHealthy = ($HealthResults | Where-Object { -not $_.Healthy } | Measure-Object).Count -eq 0
    if ($allHealthy) {
        Write-Host "All services healthy. Ready for acceptance testing." -ForegroundColor Green
    } else {
        Write-Host "Some services are unhealthy. Review the logs above." -ForegroundColor Red
    }
}

# =============================================================================
# Main
# =============================================================================

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AgentHive Cloud — Dev Environment Auto-Build & Acceptance" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Validate we're in the repo root
if (-not (Test-Path $ComposeFile)) {
    Write-Host "❌ $ComposeFile not found. Please run this script from the repository root." -ForegroundColor Red
    exit 1
}

# Validate .env.dev (warn only)
if (-not (Test-Path $EnvFile)) {
    Write-Host "⚠️  $EnvFile not found. Docker Compose will use default values." -ForegroundColor Yellow
}

Test-DockerRunning

$affected = Get-AffectedServices

# Build phase
if ($affected.Count -gt 0) {
    Write-Host ""
    Write-Host "📦 Building $($affected.Count) service(s)..." -ForegroundColor Cyan
    foreach ($svc in $affected) {
        Invoke-ServiceBuild -ServiceName $svc
    }
    Write-Host ""
    Write-Host "✅ Build phase complete." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ℹ️  No services require rebuilding." -ForegroundColor Cyan
}

# Health check phase
Write-Host ""
Write-Host "⏳ Health checking all services (timeout: ${MaxHealthWait}s each, poll: ${PollInterval}s)..." -ForegroundColor Cyan

$healthResults    = [System.Collections.Generic.List[object]]::new()
$failedServices   = [System.Collections.Generic.List[string]]::new()

foreach ($svc in $script:AllKnownServices) {
    Write-Host "   Checking $svc... " -ForegroundColor Gray -NoNewline
    $result = Wait-ServiceHealthy -ServiceName $svc
    $healthResults.Add($result)

    if ($result.Healthy) {
        Write-Host "✅ $($result.LastHealth) ($($result.Elapsed)s)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($result.LastHealth) ($($result.Elapsed)s)" -ForegroundColor Red
        $failedServices.Add($svc)

        Write-Host ""
        Write-Host "❌ Service $svc health check failed after $($result.Elapsed)s" -ForegroundColor Red
        Write-Host "--- Last 20 log lines ---" -ForegroundColor DarkYellow
        $logs = docker compose -f $ComposeFile --env-file $EnvFile logs --tail 20 $svc 2>$null
        if ($logs) {
            Write-Host ($logs -join "`n") -ForegroundColor Gray
        } else {
            Write-Host "(no logs available)" -ForegroundColor DarkGray
        }
        Write-Host ""
    }
}

# Final report
$elapsed = [math]::Round($stopwatch.Elapsed.TotalSeconds, 1)
Write-SummaryReport -Affected $affected -HealthResults $healthResults -TotalSeconds $elapsed

if ($failedServices.Count -gt 0) {
    exit 1
} else {
    exit 0
}
