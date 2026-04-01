# ==========================================
# AgentHive Cloud - Local Docker Development Script (PowerShell)
# ==========================================
# A helper script for managing local Docker Desktop deployment on Windows
#
# Usage:
#   .\scripts\local-docker.ps1 [command]
#
# Commands:
#   Start       - Start all services with hot reload
#   Stop        - Stop all services
#   Restart     - Restart all services
#   Status      - Show service status
#   Logs        - Show logs for all services
#   Logs-Web    - Show web frontend logs
#   Logs-Api    - Show supervisor API logs
#   Shell-Web   - Open shell in web container
#   Shell-Api   - Open shell in supervisor container
#   Db-Connect  - Connect to PostgreSQL database
#   Redis-Cli   - Connect to Redis CLI
#   Clean       - Clean up containers and volumes
#   Health      - Run health checks
#
# Examples:
#   .\scripts\local-docker.ps1 Start
#   .\scripts\local-docker.ps1 Logs-Api -Follow
# ==========================================

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Command = "Help",
    
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"
$OverrideFile = Join-Path $ProjectRoot "docker-compose.override.yml"
$EnvFile = Join-Path $ProjectRoot ".env"

# Colors
$Blue = "`e[36m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Cyan = "`e[96m"
$NC = "`e[0m"

# Helper functions
function Print-Header {
    Write-Host "${Blue}============================================${NC}"
    Write-Host "${Blue}  AgentHive Cloud - Local Docker${NC}"
    Write-Host "${Blue}============================================${NC}"
}

function Print-Success($message) {
    Write-Host "${Green}✓${NC} $message"
}

function Print-Error($message) {
    Write-Host "${Red}✗${NC} $message"
}

function Print-Info($message) {
    Write-Host "${Cyan}ℹ${NC} $message"
}

function Print-Warn($message) {
    Write-Host "${Yellow}⚠${NC} $message"
}

# Check prerequisites
function Test-Prerequisites {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Print-Error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    }
    
    try {
        $null = docker info 2>$null
    } catch {
        Print-Error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    }
    
    # Check for docker compose command
    if (docker compose version 2>$null) {
        $script:ComposeCmd = "docker compose"
    } elseif (docker-compose version 2>$null) {
        $script:ComposeCmd = "docker-compose"
    } else {
        Print-Error "Docker Compose is not installed."
        exit 1
    }
}

# Ensure .env file exists
function Ensure-EnvFile {
    if (-not (Test-Path $EnvFile)) {
        $LocalEnv = Join-Path $ProjectRoot ".env.local"
        $ExampleEnv = Join-Path $ProjectRoot ".env.example"
        
        if (Test-Path $LocalEnv) {
            Print-Info "Creating .env from .env.local..."
            Copy-Item $LocalEnv $EnvFile
            Print-Success ".env file created"
        } elseif (Test-Path $ExampleEnv) {
            Print-Info "Creating .env from .env.example..."
            Copy-Item $ExampleEnv $EnvFile
            Print-Warn "Please review and update .env file with your settings"
        } else {
            Print-Error "No .env file found and no template available"
            exit 1
        }
    }
}

# Check port availability
function Test-Ports {
    Print-Info "Checking port availability..."
    
    $ports = @(
        @{Port=5432; Name="PostgreSQL"},
        @{Port=6379; Name="Redis"},
        @{Port=8080; Name="Supervisor API"},
        @{Port=5173; Name="Web Frontend"}
    )
    
    $unavailable = @()
    
    foreach ($portInfo in $ports) {
        $port = $portInfo.Port
        $name = $portInfo.Name
        
        $listener = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
                    Where-Object { $_.State -eq "Listen" }
        
        if ($listener) {
            Print-Warn "Port $port is already in use (required by $name)"
            $unavailable += $portInfo
        }
    }
    
    if ($unavailable.Count -gt 0) {
        Write-Host ""
        Print-Error "Some required ports are already in use:"
        foreach ($info in $unavailable) {
            Write-Host "  - Port $($info.Port) ($($info.Name))"
        }
        Write-Host ""
        Print-Info "You can either:"
        Write-Host "  1. Stop the services using these ports"
        Write-Host "  2. Modify port mappings in .env file"
        Write-Host "  3. Use custom ports: ``$env:DB_PORT='5433'; .\scripts\local-docker.ps1 Start``"
        return $false
    }
    
    Print-Success "All required ports are available"
    return $true
}

# Start services
function Start-Services {
    Print-Header
    Write-Host ""
    
    Test-Prerequisites
    Ensure-EnvFile
    
    if (-not (Test-Ports)) {
        exit 1
    }
    
    Print-Info "Starting AgentHive Cloud services..."
    Write-Host ""
    
    # Export environment for docker-compose
    $env:WEB_TARGET = "development"
    $env:SUPERVISOR_TARGET = "development"
    
    # Build and start services
    Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" up --build -d"
    
    Write-Host ""
    Print-Success "Services started successfully!"
    Write-Host ""
    Write-Host "${Cyan}Service URLs:${NC}"
    Write-Host "  - Web Frontend: ${Yellow}http://localhost:5173${NC}"
    Write-Host "  - API Backend:  ${Yellow}http://localhost:8080${NC}"
    Write-Host "  - API Docs:     ${Yellow}http://localhost:8080/swagger/index.html${NC}"
    Write-Host "  - PostgreSQL:   ${Yellow}localhost:5432${NC}"
    Write-Host "  - Redis:        ${Yellow}localhost:6379${NC}"
    Write-Host ""
    Write-Host "${Cyan}Useful commands:${NC}"
    Write-Host "  .\scripts\local-docker.ps1 Status  - Check service status"
    Write-Host "  .\scripts\local-docker.ps1 Logs    - View logs"
    Write-Host "  .\scripts\local-docker.ps1 Health  - Run health checks"
    Write-Host ""
    
    # Wait a moment for services to initialize
    Start-Sleep -Seconds 2
    
    # Show initial status
    Show-Status
}

# Stop services
function Stop-Services {
    Print-Header
    Write-Host ""
    
    Test-Prerequisites
    
    Print-Info "Stopping AgentHive Cloud services..."
    Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" down"
    
    Write-Host ""
    Print-Success "Services stopped"
}

# Restart services
function Restart-Services {
    Print-Header
    Write-Host ""
    
    Stop-Services
    Write-Host ""
    Start-Services
}

# Show status
function Show-Status {
    Print-Header
    Write-Host ""
    
    Test-Prerequisites
    
    Write-Host "${Cyan}Container Status:${NC}"
    Write-Host ""
    Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" ps"
    
    Write-Host ""
    Write-Host "${Cyan}Service Health:${NC}"
    Write-Host ""
    
    $services = @(
        @{Container="postgres"; Name="PostgreSQL"},
        @{Container="redis"; Name="Redis"},
        @{Container="supervisor"; Name="Supervisor API"},
        @{Container="web"; Name="Web Frontend"}
    )
    
    foreach ($service in $services) {
        $container = $service.Container
        $name = $service.Name
        
        $running = docker ps --format "{{.Names}}" | Select-String -Pattern "^${container}$"
        if ($running) {
            Print-Success "$name is running"
        } else {
            Print-Error "$name is not running"
        }
    }
}

# Show logs
function Show-Logs($service = $null, $follow = $false) {
    Test-Prerequisites
    
    $args = @()
    if ($follow) { $args += "-f" }
    if ($service) { $args += $service }
    
    $argString = $args -join " "
    Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" logs $argString"
}

# Open shell in container
function Enter-Shell($service) {
    Test-Prerequisites
    Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" exec $service sh"
}

# Connect to database
function Connect-Database {
    Test-Prerequisites
    
    # Load environment variables from .env
    if (Test-Path $EnvFile) {
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^([^#][^=]*)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                Set-Item -Path "env:$name" -Value $value
            }
        }
    }
    
    $dbUser = $env:DB_USER -or "agenthive"
    
    Print-Info "Connecting to PostgreSQL as $dbUser..."
    Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" exec postgres psql -U `"$dbUser`""
}

# Connect to Redis
function Connect-Redis {
    Test-Prerequisites
    
    # Load environment variables from .env
    if (Test-Path $EnvFile) {
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^([^#][^=]*)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                Set-Item -Path "env:$name" -Value $value
            }
        }
    }
    
    $redisPassword = $env:REDIS_PASSWORD -or "redis_local_secret"
    
    Print-Info "Connecting to Redis..."
    Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" exec redis redis-cli -a `"$redisPassword`""
}

# Clean up
function Clear-Environment {
    Print-Header
    Write-Host ""
    
    Test-Prerequisites
    
    Print-Warn "This will remove all containers and volumes (data will be lost)"
    $confirm = Read-Host "Are you sure? [y/N]"
    
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        Print-Info "Stopping and removing containers..."
        Invoke-Expression "$ComposeCmd -f `"$ComposeFile`" -f `"$OverrideFile`" down -v --remove-orphans"
        
        Print-Info "Cleaning up unused Docker resources..."
        docker system prune -f
        
        Print-Success "Cleanup completed"
    } else {
        Print-Info "Cleanup cancelled"
    }
}

# Run health checks
function Test-Health {
    Test-Prerequisites
    
    $healthScript = Join-Path $ScriptDir "health-check.sh"
    if (Test-Path $healthScript) {
        & bash $healthScript
    } else {
        Print-Error "Health check script not found"
    }
}

# Show help
function Show-Help {
    Print-Header
    Write-Host ""
    Write-Host "Usage: .\scripts\local-docker.ps1 [command]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  ${Cyan}Start${NC}       Start all services with hot reload"
    Write-Host "  ${Cyan}Stop${NC}        Stop all services"
    Write-Host "  ${Cyan}Restart${NC}     Restart all services"
    Write-Host "  ${Cyan}Status${NC}      Show service status"
    Write-Host "  ${Cyan}Logs${NC}        Show logs for all services"
    Write-Host "  ${Cyan}Logs-Web${NC}    Show web frontend logs"
    Write-Host "  ${Cyan}Logs-Api${NC}    Show supervisor API logs"
    Write-Host "  ${Cyan}Shell-Web${NC}   Open shell in web container"
    Write-Host "  ${Cyan}Shell-Api${NC}   Open shell in supervisor container"
    Write-Host "  ${Cyan}Db-Connect${NC}  Connect to PostgreSQL database"
    Write-Host "  ${Cyan}Redis-Cli${NC}   Connect to Redis CLI"
    Write-Host "  ${Cyan}Clean${NC}       Clean up containers and volumes"
    Write-Host "  ${Cyan}Health${NC}      Run health checks"
    Write-Host "  ${Cyan}Help${NC}        Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\local-docker.ps1 Start"
    Write-Host "  .\scripts\local-docker.ps1 Logs-Api -f"
    Write-Host "  .\scripts\local-docker.ps1 Db-Connect"
    Write-Host ""
}

# Main command dispatcher
switch ($Command.ToLower()) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "restart" { Restart-Services }
    "status" { Show-Status }
    "logs" { Show-Logs -follow ($Arguments -contains "-f") }
    "logs-web" { Show-Logs -service "web" -follow ($Arguments -contains "-f") }
    "logs-api" { Show-Logs -service "supervisor" -follow ($Arguments -contains "-f") }
    "shell-web" { Enter-Shell -service "web" }
    "shell-api" { Enter-Shell -service "supervisor" }
    "db-connect" { Connect-Database }
    "redis-cli" { Connect-Redis }
    "clean" { Clear-Environment }
    "health" { Test-Health }
    "help" { Show-Help }
    "--help" { Show-Help }
    "-h" { Show-Help }
    default {
        Print-Error "Unknown command: $Command"
        Write-Host ""
        Show-Help
        exit 1
    }
}
