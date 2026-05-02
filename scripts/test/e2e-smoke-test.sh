#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud - E2E Smoke Test (Bash)
# TICKET: TICKET-E2E-001
# Purpose: Automated acceptance test for dev environment rebuild
# Usage  : bash scripts/e2e-smoke-test.sh
# =============================================================================
set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
TOTAL=0
ERRORS=()

REQUIRED_CONTAINERS=(
  "agenthive-landing-dev"
  "agenthive-nginx-dev"
  "agenthive-gateway-dev"
  "agenthive-auth-dev"
  "agenthive-order-dev"
  "agenthive-payment-dev"
  "agenthive-cart-dev"
  "agenthive-logistics-dev"
  "agenthive-api-dev"
  "agenthive-postgres-dev"
  "agenthive-redis-dev"
  "agenthive-rabbitmq-dev"
  "agenthive-nacos-dev"
)

TEST_USER="e2e_smoke_user"
TEST_PASS="SmokeTest123!"
TEST_EMAIL="smoke@test.com"
API_BASE="http://localhost:8080"
LANDING_URL="http://localhost:3000"

die() { echo -e "${RED}FAIL${NC}  $1"; ERRORS+=("$1"); ((FAIL++)); ((TOTAL++)); }
ok()  { echo -e "${GREEN}PASS${NC}  $1"; ((PASS++)); ((TOTAL++)); }
warn() { echo -e "${YELLOW}WARN${NC}  $1"; }

# ---------------------------------------------------------------------------
# 1. Container Health Check
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} 1. Container Health Check${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

for container in "${REQUIRED_CONTAINERS[@]}"; do
  status=$(docker ps --filter "name=${container}" --format '{{.Status}}' 2>/dev/null || true)
  if [[ -z "$status" ]]; then
    die "[$container] not found"
  elif [[ "$status" == *"unhealthy"* ]]; then
    die "[$container] unhealthy: $status"
  elif [[ "$status" == *"healthy"* || "$status" == *"Up"* ]]; then
    ok "[$container] $status"
  else
    warn "[$container] $status"
  fi
done

# ---------------------------------------------------------------------------
# 2. Register test user (idempotent)
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} 2. Register Test User${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

register_resp=$(curl -s -X POST "${API_BASE}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\",\"email\":\"${TEST_EMAIL}\"}" 2>/dev/null || true)

if echo "$register_resp" | grep -q '"code":200'; then
  ok "[Register] User created successfully"
elif echo "$register_resp" | grep -q 'already exists\|Duplicate'; then
  ok "[Register] User already exists (idempotent)"
else
  warn "[Register] Unexpected response: $register_resp"
fi

# ---------------------------------------------------------------------------
# 3. Login Test
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} 3. Login Test${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

login_resp=$(curl -s -X POST "${API_BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}" 2>/dev/null || true)

if echo "$login_resp" | grep -q '"code":200'; then
  ok "[Login] HTTP 200 with token"
else
  die "[Login] Failed: $login_resp"
fi

ACCESS_TOKEN=$(echo "$login_resp" | grep -oP '"accessToken":"\K[^"]+' || true)
if [[ -z "$ACCESS_TOKEN" ]]; then
  die "[Login] accessToken not found in response"
else
  ok "[Login] accessToken extracted"
fi

# ---------------------------------------------------------------------------
# 4. Token Subject Check (numeric, not UUID)
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} 4. Token Subject Check${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

payload=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
# Pad base64
padlen=$((4 - ${#payload} % 4))
if [[ $padlen -ne 4 ]]; then
  payload="${payload}$(printf '=%.0s' $(seq 1 $padlen))"
fi
decoded=$(echo "$payload" | tr '_-' '/+' | base64 -d 2>/dev/null || true)
sub=$(echo "$decoded" | grep -oP '"sub":"\K[^"]+' || true)

if [[ -z "$sub" ]]; then
  die "[Token] subject not found in JWT payload"
else
  if [[ "$sub" =~ ^[0-9]+$ ]]; then
    ok "[Token] subject is numeric: $sub"
  else
    die "[Token] subject is NOT numeric (UUID?): $sub"
  fi
fi

# ---------------------------------------------------------------------------
# 5. /me Endpoint Test
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} 5. /me Endpoint Test${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

me_resp=$(curl -s "${API_BASE}/api/auth/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" 2>/dev/null || true)

if echo "$me_resp" | grep -q '"code":200'; then
  ok "[/me] HTTP 200 with user data"
else
  die "[/me] Failed: $me_resp"
fi

if echo "$me_resp" | grep -q '"username"'; then
  ok "[/me] Contains username field"
else
  die "[/me] Missing username field"
fi

# ---------------------------------------------------------------------------
# 6. Frontend Landing Test
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} 6. Frontend Landing Test${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

landing_http=$(curl -s -o /dev/null -w "%{http_code}" "${LANDING_URL}/" 2>/dev/null || echo "000")
if [[ "$landing_http" == "200" ]]; then
  ok "[Landing] HTTP 200"
else
  die "[Landing] HTTP $landing_http"
fi

# ---------------------------------------------------------------------------
# 7. Docker Compose "variable is not set" Check
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} 7. Docker Compose Variable Check${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

var_warnings=$(docker compose -f docker-compose.dev.yml --env-file .env.dev config 2>&1 | grep -c "variable is not set" || echo "0")
if [[ "$var_warnings" == "0" ]]; then
  ok "[Config] No 'variable is not set' warnings"
else
  die "[Config] Found $var_warnings 'variable is not set' warnings"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} E2E Smoke Test Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
printf "  %-20s %s\n" "Total checks:" "$TOTAL"
printf "  ${GREEN}%-20s${NC} %s\n" "Passed:" "$PASS"
printf "  ${RED}%-20s${NC} %s\n" "Failed:" "$FAIL"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo -e "${RED}${BOLD} Details:${NC}"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  echo ""
  echo -e "${RED}${BOLD} OVERALL: FAIL${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}${BOLD} OVERALL: PASS${NC}"
  exit 0
fi
