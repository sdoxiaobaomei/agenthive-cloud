#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Dev Environment Health Check
# TICKET: TICKET-PLAT-DEV-005
# Purpose: Verify all services after `docker compose up` (read-only, safe to rerun)
# Usage  : bash scripts/health-check-dev.sh
# =============================================================================

set -uo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# --- Configuration ---
ENV_FILE=".env.dev"
COMPOSE_FILE="docker-compose.dev.yml"
TIMEOUT_SEC=5
MAX_TIME_SEC=8

PASS=0
FAIL=0
WARN=0
DIAGNOSIS=()

START_TIME=$SECONDS

# --- .env.dev / Compose Config Check ---
print_header "🔍 Environment & Compose Config"

compose_warnings=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config 2>&1 | grep -c "variable is not set" || true)
if [[ "$compose_warnings" -eq 0 ]]; then
  print_row "PASS" ".env.dev loaded" "No unset variables"
else
  print_row "WARN" ".env.dev loaded" "$compose_warnings unset variable(s)"
  add_diagnosis "[.env.dev] $compose_warnings environment variable(s) are not set. Run: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE config 2>&1 | grep 'variable is not set'"
fi

# --- Load .env.dev if exists (safe sourcing) ---
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    # Only export lines that look like VAR=value
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line" 2>/dev/null || true
    fi
  done < "$ENV_FILE"
fi

# Defaults from docker-compose.dev.yml
DB_USER="${DB_USER:-agenthive}"
DB_PASSWORD="${DB_PASSWORD:-dev}"
DB_NAME="${DB_NAME:-agenthive}"
DB_PORT="${DB_PORT:-5433}"
REDIS_PASSWORD="${REDIS_PASSWORD:-agenthive}"
REDIS_PORT="${REDIS_PORT:-6379}"
RABBITMQ_USER="${RABBITMQ_USER:-agenthive}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-agenthive-secret}"
LANDING_PORT="${LANDING_PORT:-3000}"
API_PORT="${API_PORT:-3001}"
NACOS_USERNAME="${NACOS_USERNAME:-agenthive}"
NACOS_PASSWORD="${NACOS_PASSWORD:-agenthive-secret-2024}"

# --- Helpers ---
print_header() {
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}$1${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
}

print_row() {
  local status="$1"
  local item="$2"
  local detail="$3"
  if [[ "$status" == "PASS" ]]; then
    printf "  ${GREEN}%-4s${NC}  %-28s %s\n" "✅" "$item" "$detail"
    ((PASS++))
  elif [[ "$status" == "FAIL" ]]; then
    printf "  ${RED}%-4s${NC}  %-28s %s\n" "❌" "$item" "$detail"
    ((FAIL++))
  else
    printf "  ${YELLOW}%-4s${NC}  %-28s %s\n" "⚠️" "$item" "$detail"
    ((WARN++))
  fi
}

add_diagnosis() {
  DIAGNOSIS+=("$1")
}

# --- Pre-flight: Docker ---
if ! command -v docker &>/dev/null; then
  print_header "🚨 Docker not found"
  echo -e "${RED}Docker is not installed or not in PATH.${NC}"
  echo "Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info &>/dev/null; then
  print_header "🚨 Docker daemon not running"
  echo -e "${RED}Docker daemon is not running.${NC}"
  echo "  Linux : sudo systemctl start docker"
  echo "  macOS : open -a Docker"
  echo "  Windows: Start Docker Desktop"
  add_diagnosis "Docker daemon not running"
fi

# --- Container Status ---
print_header "🐳 Container Status"

# service_name:container_name
declare -a SERVICES=(
  "postgres:agenthive-postgres-dev"
  "redis:agenthive-redis-dev"
  "nacos:agenthive-nacos-dev"
  "rabbitmq:agenthive-rabbitmq-dev"
  "api:agenthive-api-dev"
  "landing:agenthive-landing-dev"
  "gateway-service:agenthive-gateway-dev"
  "auth-service:agenthive-auth-dev"
  "payment-service:agenthive-payment-dev"
  "order-service:agenthive-order-dev"
  "cart-service:agenthive-cart-dev"
  "logistics-service:agenthive-logistics-dev"
  "nginx:agenthive-nginx-dev"
)

DOCKER_LIST=""
if docker info &>/dev/null; then
  DOCKER_LIST=$(docker ps --format '{{.Names}}|{{.State}}' 2>/dev/null || true)
fi

for entry in "${SERVICES[@]}"; do
  service="${entry%%:*}"
  container="${entry##*:}"

  if echo "$DOCKER_LIST" | grep -q "^${container}|running$"; then
    print_row "PASS" "$service" "$container running"
  else
    if echo "$DOCKER_LIST" | grep -q "^${container}|"; then
      state=$(echo "$DOCKER_LIST" | grep "^${container}|" | cut -d'|' -f2)
      print_row "FAIL" "$service" "$container state: $state"
      add_diagnosis "[$service] Container is '$state' (not running). Fix: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d $service"
    else
      print_row "FAIL" "$service" "$container not found"
      add_diagnosis "[$service] Container not found. Fix: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d $service"
    fi
  fi
done

# --- HTTP Health Checks ---
print_header "🌐 Service Health Endpoints"

check_http() {
  local name="$1"
  local url="$2"
  local container="$3"

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$MAX_TIME_SEC" "$url" 2>/dev/null || echo "000")

  if [[ "$http_code" == "200" ]]; then
    print_row "PASS" "$name" "HTTP 200"
  elif [[ "$http_code" == "503" ]]; then
    print_row "WARN" "$name" "HTTP 503 (degraded)"
    add_diagnosis "[$name] Service is up but reporting degraded (HTTP 503). Fix: docker logs $container"
  else
    print_row "FAIL" "$name" "HTTP $http_code"
    add_diagnosis "[$name] Health endpoint returned HTTP $http_code. Fix: docker logs $container"
  fi
}

check_http "Gateway"     "http://localhost:8080/actuator/health" "agenthive-gateway-dev"
check_http "Auth"        "http://localhost:8081/actuator/health" "agenthive-auth-dev"
check_http "Payment"     "http://localhost:8083/actuator/health" "agenthive-payment-dev"
check_http "Order"       "http://localhost:8084/actuator/health" "agenthive-order-dev"
check_http "Cart"        "http://localhost:8085/actuator/health" "agenthive-cart-dev"
check_http "Logistics"   "http://localhost:8086/actuator/health" "agenthive-logistics-dev"
check_http "Node API"    "http://localhost:${API_PORT}/api/health" "agenthive-api-dev"
check_http "API /me"     "http://localhost:${API_PORT}/api/me"    "agenthive-api-dev"
check_http "Landing"     "http://localhost:${LANDING_PORT}"       "agenthive-landing-dev"

# --- Database Checks ---
print_header "🐘 PostgreSQL Databases"

check_db() {
  local name="$1"
  local db="$2"

  if docker exec -e PGPASSWORD="$DB_PASSWORD" agenthive-postgres-dev psql -U "$DB_USER" -d "$db" -c 'SELECT 1' &>/dev/null; then
    print_row "PASS" "$name DB" "$db OK"
  else
    print_row "FAIL" "$name DB" "$db connection failed"
    add_diagnosis "[$name DB] psql connection failed. Fix: docker logs agenthive-postgres-dev"
  fi
}

check_db "Main"      "$DB_NAME"
check_db "Auth"      "auth_db"
check_db "User"      "user_db"
check_db "Payment"   "payment_db"
check_db "Order"     "order_db"
check_db "Cart"      "cart_db"
check_db "Logistics" "logistics_db"

# --- Redis ---
print_header "🔴 Redis"

redis_response=$(docker exec agenthive-redis-dev redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null || echo "ERROR")
if [[ "$redis_response" == "PONG" ]]; then
  print_row "PASS" "Redis" "PONG"
else
  print_row "FAIL" "Redis" "No PONG (response: $redis_response)"
  add_diagnosis "[Redis] redis-cli ping failed. Fix: docker logs agenthive-redis-dev"
fi

# --- Nacos Service Registry ---
print_header "📋 Nacos Service Registry"

nacos_token=$(curl -s -X POST --max-time "$MAX_TIME_SEC" "http://localhost:8848/nacos/v1/auth/login" \
  -d "username=${NACOS_USERNAME}&password=${NACOS_PASSWORD}" 2>/dev/null | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p' || true)

nacos_url="http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=10"
[[ -n "$nacos_token" ]] && nacos_url="${nacos_url}&accessToken=${nacos_token}"

nacos_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$MAX_TIME_SEC" "$nacos_url" 2>/dev/null || echo "000")
if [[ "$nacos_code" == "200" ]]; then
  print_row "PASS" "Nacos API" "HTTP 200"
else
  print_row "FAIL" "Nacos API" "HTTP $nacos_code"
  add_diagnosis "[Nacos] Service list API returned HTTP $nacos_code. Fix: docker logs agenthive-nacos-dev"
fi

# Check individual Java services registered in Nacos
NACOS_SERVICES=("gateway-service" "auth-service" "payment-service" "order-service" "cart-service" "logistics-service")
for svc in "${NACOS_SERVICES[@]}"; do
  svc_url="http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=10&serviceName=${svc}"
  [[ -n "$nacos_token" ]] && svc_url="${svc_url}&accessToken=${nacos_token}"
  svc_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$MAX_TIME_SEC" "$svc_url" 2>/dev/null || echo "000")
  if [[ "$svc_code" == "200" ]]; then
    print_row "PASS" "Nacos: $svc" "registered"
  else
    print_row "FAIL" "Nacos: $svc" "not registered (HTTP $svc_code)"
    add_diagnosis "[Nacos: $svc] Service not registered. Fix: docker logs agenthive-${svc%-service}-dev"
  fi
done

# --- RabbitMQ ---
print_header "🐇 RabbitMQ Management"

rmq_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$MAX_TIME_SEC" \
  -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" "http://localhost:15672/api/overview" 2>/dev/null || echo "000")
if [[ "$rmq_code" == "200" ]]; then
  print_row "PASS" "RabbitMQ" "HTTP 200"
else
  print_row "FAIL" "RabbitMQ" "HTTP $rmq_code"
  add_diagnosis "[RabbitMQ] Management API returned HTTP $rmq_code. Fix: docker logs agenthive-rabbitmq-dev"
fi

# --- Summary ---
print_header "📊 Health Check Summary"

ELAPSED=$((SECONDS - START_TIME))

printf "  %-20s %s\n" "Total checks:" "$((PASS + FAIL + WARN))"
printf "  ${GREEN}%-20s${NC} %s\n" "✅ Passed:" "$PASS"
printf "  ${RED}%-20s${NC} %s\n" "❌ Failed:" "$FAIL"
printf "  ${YELLOW}%-20s${NC} %s\n" "⚠️  Warnings:" "$WARN"
printf "  %-20s %s\n" "Execution time:" "${ELAPSED}s"

if [[ ${#DIAGNOSIS[@]} -gt 0 ]]; then
  echo ""
  echo -e "${BOLD}🔧 Diagnosis & Suggested Fixes${NC}"
  echo -e "${BOLD}───────────────────────────────────────────────────────────────${NC}"
  for item in "${DIAGNOSIS[@]}"; do
    echo -e "  ${YELLOW}•${NC} $item"
  done
fi

echo ""
if [[ $FAIL -eq 0 && $WARN -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✅ All checks passed! Dev environment is healthy.${NC}"
  exit 0
elif [[ $FAIL -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}⚠️  Dev environment is functional with warnings.${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}❌ Dev environment has failures. Review diagnosis above.${NC}"
  exit 1
fi
