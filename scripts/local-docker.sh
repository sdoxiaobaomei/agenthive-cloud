#!/bin/bash
# ==========================================
# AgentHive Cloud - Local Docker Development Script
# ==========================================
# A helper script for managing local Docker Desktop deployment
#
# Usage:
#   ./scripts/local-docker.sh [command]
#
# Commands:
#   start       - Start all services with hot reload
#   stop        - Stop all services
#   restart     - Restart all services
#   status      - Show service status
#   logs        - Show logs for all services
#   logs-web    - Show web frontend logs
#   logs-api    - Show supervisor API logs
#   shell-web   - Open shell in web container
#   shell-api   - Open shell in supervisor container
#   db-connect  - Connect to PostgreSQL database
#   redis-cli   - Connect to Redis CLI
#   clean       - Clean up containers and volumes
#   health      - Run health checks
#
# Examples:
#   ./scripts/local-docker.sh start
#   ./scripts/local-docker.sh logs-api -f
# ==========================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
OVERRIDE_FILE="${PROJECT_ROOT}/docker-compose.override.yml"
ENV_FILE="${PROJECT_ROOT}/.env"

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  AgentHive Cloud - Local Docker${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi

    # Check for docker compose command
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif docker-compose version &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        print_error "Docker Compose is not installed."
        exit 1
    fi
}

# Ensure .env file exists
ensure_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${PROJECT_ROOT}/.env.local" ]; then
            print_info "Creating .env from .env.local..."
            cp "${PROJECT_ROOT}/.env.local" "$ENV_FILE"
            print_success ".env file created"
        elif [ -f "${PROJECT_ROOT}/.env.example" ]; then
            print_info "Creating .env from .env.example..."
            cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
            print_warn "Please review and update .env file with your settings"
        else
            print_error "No .env file found and no template available"
            exit 1
        fi
    fi
}

# Check port availability
check_ports() {
    print_info "Checking port availability..."
    
    local ports=("5432:PostgreSQL" "6379:Redis" "8080:Supervisor API" "5173:Web Frontend")
    local unavailable=()
    
    for port_info in "${ports[@]}"; do
        IFS=':' read -r port service <<< "$port_info"
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
            print_warn "Port $port is already in use (required by $service)"
            unavailable+=("$port:$service")
        fi
    done
    
    if [ ${#unavailable[@]} -gt 0 ]; then
        echo ""
        print_error "Some required ports are already in use:"
        for info in "${unavailable[@]}"; do
            IFS=':' read -r port service <<< "$info"
            echo "  - Port $port ($service)"
        done
        echo ""
        print_info "You can either:"
        echo "  1. Stop the services using these ports"
        echo "  2. Modify port mappings in .env file"
        echo "  3. Use custom ports: export DB_PORT=5433 && ./scripts/local-docker.sh start"
        return 1
    fi
    
    print_success "All required ports are available"
    return 0
}

# Start services
cmd_start() {
    print_header
    echo ""
    
    check_prerequisites
    ensure_env_file
    
    if ! check_ports; then
        exit 1
    fi
    
    print_info "Starting AgentHive Cloud services..."
    echo ""
    
    # Export environment for docker-compose
    export WEB_TARGET=development
    export SUPERVISOR_TARGET=development
    
    # Build and start services
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" up --build -d
    
    echo ""
    print_success "Services started successfully!"
    echo ""
    echo -e "${CYAN}Service URLs:${NC}"
    echo "  - Web Frontend: ${YELLOW}http://localhost:5173${NC}"
    echo "  - API Backend:  ${YELLOW}http://localhost:8080${NC}"
    echo "  - API Docs:     ${YELLOW}http://localhost:8080/swagger/index.html${NC}"
    echo "  - PostgreSQL:   ${YELLOW}localhost:5432${NC}"
    echo "  - Redis:        ${YELLOW}localhost:6379${NC}"
    echo ""
    echo -e "${CYAN}Useful commands:${NC}"
    echo "  ./scripts/local-docker.sh status  - Check service status"
    echo "  ./scripts/local-docker.sh logs    - View logs"
    echo "  ./scripts/local-docker.sh health  - Run health checks"
    echo ""
    
    # Wait a moment for services to initialize
    sleep 2
    
    # Show initial status
    cmd_status
}

# Stop services
cmd_stop() {
    print_header
    echo ""
    
    check_prerequisites
    
    print_info "Stopping AgentHive Cloud services..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" down
    
    echo ""
    print_success "Services stopped"
}

# Restart services
cmd_restart() {
    print_header
    echo ""
    
    cmd_stop
    echo ""
    cmd_start
}

# Show status
cmd_status() {
    print_header
    echo ""
    
    check_prerequisites
    
    echo -e "${CYAN}Container Status:${NC}"
    echo ""
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" ps
    
    echo ""
    echo -e "${CYAN}Service Health:${NC}"
    echo ""
    
    # Check each service
    services=("postgres:PostgreSQL" "redis:Redis" "supervisor:Supervisor API" "web:Web Frontend")
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r container name <<< "$service_info"
        if $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" ps | grep -q "${container}.*Up"; then
            print_success "$name is running"
        else
            print_error "$name is not running"
        fi
    done
}

# Show logs
cmd_logs() {
    check_prerequisites
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" logs "$@"
}

# Show web logs
cmd_logs_web() {
    check_prerequisites
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" logs web "$@"
}

# Show API logs
cmd_logs_api() {
    check_prerequisites
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" logs supervisor "$@"
}

# Open shell in web container
cmd_shell_web() {
    check_prerequisites
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" exec web sh
}

# Open shell in API container
cmd_shell_api() {
    check_prerequisites
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" exec supervisor sh
}

# Connect to database
cmd_db_connect() {
    check_prerequisites
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    fi
    
    local db_user="${DB_USER:-agenthive}"
    local db_name="${DB_NAME:-agenthive_local}"
    
    print_info "Connecting to PostgreSQL as $db_user..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" exec postgres psql -U "$db_user" -d "$db_name"
}

# Connect to Redis
cmd_redis_cli() {
    check_prerequisites
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    fi
    
    local redis_password="${REDIS_PASSWORD:-redis_local_secret}"
    
    print_info "Connecting to Redis..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" exec redis redis-cli -a "$redis_password"
}

# Clean up
cmd_clean() {
    print_header
    echo ""
    
    check_prerequisites
    
    print_warn "This will remove all containers and volumes (data will be lost)"
    read -p "Are you sure? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Stopping and removing containers..."
        $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" down -v --remove-orphans
        
        print_info "Cleaning up unused Docker resources..."
        docker system prune -f
        
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Run health checks
cmd_health() {
    check_prerequisites
    
    print_header
    echo ""
    
    bash "${SCRIPT_DIR}/health-check.sh"
}

# Show help
cmd_help() {
    print_header
    echo ""
    echo "Usage: ./scripts/local-docker.sh [command]"
    echo ""
    echo "Commands:"
    echo "  ${CYAN}start${NC}       Start all services with hot reload"
    echo "  ${CYAN}stop${NC}        Stop all services"
    echo "  ${CYAN}restart${NC}     Restart all services"
    echo "  ${CYAN}status${NC}      Show service status"
    echo "  ${CYAN}logs${NC}        Show logs for all services"
    echo "  ${CYAN}logs-web${NC}    Show web frontend logs"
    echo "  ${CYAN}logs-api${NC}    Show supervisor API logs"
    echo "  ${CYAN}shell-web${NC}   Open shell in web container"
    echo "  ${CYAN}shell-api${NC}   Open shell in supervisor container"
    echo "  ${CYAN}db-connect${NC}  Connect to PostgreSQL database"
    echo "  ${CYAN}redis-cli${NC}   Connect to Redis CLI"
    echo "  ${CYAN}clean${NC}       Clean up containers and volumes"
    echo "  ${CYAN}health${NC}      Run health checks"
    echo "  ${CYAN}help${NC}        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/local-docker.sh start"
    echo "  ./scripts/local-docker.sh logs-api -f"
    echo "  ./scripts/local-docker.sh db-connect"
    echo ""
}

# Main command dispatcher
main() {
    case "${1:-help}" in
        start)
            cmd_start
            ;;
        stop)
            cmd_stop
            ;;
        restart)
            cmd_restart
            ;;
        status)
            cmd_status
            ;;
        logs)
            shift
            cmd_logs "$@"
            ;;
        logs-web)
            shift
            cmd_logs_web "$@"
            ;;
        logs-api)
            shift
            cmd_logs_api "$@"
            ;;
        shell-web)
            cmd_shell_web
            ;;
        shell-api)
            cmd_shell_api
            ;;
        db-connect|db)
            cmd_db_connect
            ;;
        redis-cli|redis)
            cmd_redis_cli
            ;;
        clean)
            cmd_clean
            ;;
        health)
            cmd_health
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
