@echo off
REM ==========================================
REM AgentHive Cloud - Local Docker Development Script (Windows Batch)
REM ==========================================
REM Usage: scripts\local-docker.bat [command]
REM
cd /d "%~dp0\.."

if "%~1"=="" goto help
if /i "%~1"=="help" goto help
if /i "%~1"=="start" goto start
if /i "%~1"=="stop" goto stop
if /i "%~1"=="restart" goto restart
if /i "%~1"=="status" goto status
if /i "%~1"=="logs" goto logs
if /i "%~1"=="logs-web" goto logs-web
if /i "%~1"=="logs-api" goto logs-api
if /i "%~1"=="health" goto health
goto unknown

:start
echo ============================================
echo   AgentHive Cloud - Starting Services
echo ============================================
echo.

REM Check if .env exists, if not create from .env.local
if not exist ".env" (
    if exist ".env.local" (
        echo Creating .env from .env.local...
        copy ".env.local" ".env"
    ) else (
        echo ERROR: No .env file found!
        exit /b 1
    )
)

REM Set environment variables
set WEB_TARGET=development
set SUPERVISOR_TARGET=development

REM Check for docker compose command
docker compose version >nul 2>&1
if %errorlevel% == 0 (
    set COMPOSE_CMD=docker compose
) else (
    set COMPOSE_CMD=docker-compose
)

echo Starting services...
%COMPOSE_CMD% -f docker-compose.yml -f docker-compose.override.yml up --build -d

echo.
echo ============================================
echo   Services Started Successfully!
echo ============================================
echo.
echo Service URLs:
echo   - Web Frontend: http://localhost:5173
echo   - API Backend:  http://localhost:8080
echo   - API Docs:     http://localhost:8080/swagger/index.html
echo   - PostgreSQL:   localhost:5432
echo   - Redis:        localhost:6379
echo.
echo Useful commands:
echo   scripts\local-docker.bat status  - Check service status
echo   scripts\local-docker.bat logs    - View logs
echo   scripts\local-docker.bat health  - Run health checks
echo.
goto end

:stop
echo Stopping services...
docker compose -f docker-compose.yml -f docker-compose.override.yml down
echo Services stopped.
goto end

:restart
call :stop
call :start
goto end

:status
echo ============================================
echo   Container Status
echo ============================================
docker compose -f docker-compose.yml -f docker-compose.override.yml ps
echo.
echo Service Health:
docker ps --format "table {{.Names}}\t{{.Status}}" --filter "name=agenthive-"
goto end

:logs
docker compose -f docker-compose.yml -f docker-compose.override.yml logs %2 %3 %4
goto end

:logs-web
docker compose -f docker-compose.yml -f docker-compose.override.yml logs web %2 %3 %4
goto end

:logs-api
docker compose -f docker-compose.yml -f docker-compose.override.yml logs supervisor %2 %3 %4
goto end

:health
echo ============================================
echo   Running Health Checks
echo ============================================
echo.
echo Checking Docker...
docker --version
if %errorlevel% neq 0 (
    echo ERROR: Docker not found!
    exit /b 1
)

echo.
echo Checking containers...
docker ps --filter "name=agenthive-" --format "table {{.Names}}\t{{.Status}}"

echo.
echo Checking endpoints...
echo - Web Frontend (http://localhost:5173/):
curl -s -o nul -w "%%{http_code}" http://localhost:5173/
echo.
echo - API Health (http://localhost:8080/health):
curl -s http://localhost:8080/health || echo Failed to connect
echo.
goto end

:help
echo ============================================
echo   AgentHive Cloud - Local Docker Commands
echo ============================================
echo.
echo Usage: scripts\local-docker.bat [command]
echo.
echo Commands:
echo   start      Start all services with hot reload
echo   stop       Stop all services
echo   restart    Restart all services
echo   status     Show service status
echo   logs       Show logs for all services
echo   logs-web   Show web frontend logs
echo   logs-api   Show supervisor API logs
echo   health     Run health checks
echo   help       Show this help message
echo.
echo Examples:
echo   scripts\local-docker.bat start
echo   scripts\local-docker.bat logs-api -f
goto end

:unknown
echo ERROR: Unknown command: %~1
echo.
goto help

:end
