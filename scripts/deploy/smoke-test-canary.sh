#!/bin/bash
# ============================================================================
# smoke-test-canary.sh — 灰度版本冒烟测试
# 用途: 在 canary 版本上运行自动化冒烟测试，验证核心链路
# 前提: 灰度版本已部署，灰度 Ingress 已配置
# 用法: bash smoke-test-canary.sh [API_URL] [CANARY_COOKIE_VALUE]
# ============================================================================

set -euo pipefail

API_URL="${1:-https://api.agenthive.cloud}"
CANARY_COOKIE="${2:-agenthive-canary=always}"
PASS=0
FAIL=0

echo "========================================"
echo "  🧪 AgentHive 灰度冒烟测试"
echo "  URL: ${API_URL}"
echo "  Canary: ${CANARY_COOKIE}"
echo "========================================"
echo ""

# ---- Helper ----
test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expect="$4"
  local body="${5:-}"

  local cmd="curl -s -b '${CANARY_COOKIE}' -o /tmp/smoke_response.json -w '%{http_code}'"
  cmd="${cmd} -X ${method}"

  if [ -n "${body}" ]; then
    cmd="${cmd} -H 'Content-Type: application/json' -d '${body}'"
  fi

  cmd="${cmd} '${API_URL}${path}'"

  local http_code
  http_code=$(eval "${cmd}" 2>/dev/null)

  if echo "${http_code}" | grep -q "${expect}"; then
    echo "  ✅ ${name} (HTTP ${http_code})"
    PASS=$((PASS + 1))
  else
    echo "  ❌ ${name} (expected ${expect}, got ${http_code})"
    cat /tmp/smoke_response.json 2>/dev/null | head -5
    FAIL=$((FAIL + 1))
  fi
}

# ---- 1. Health Check ----
echo "📋 1. Health Check"
test_endpoint "Health" "GET" "/health" "200"
echo ""

# ---- 2. 静态资源 ----
echo "📋 2. Static Assets"
test_endpoint "Landing" "GET" "/" "200"
echo ""

# ---- 3. API 端点 ----
echo "📋 3. API Endpoints"
test_endpoint "API Docs" "GET" "/api/docs" "200"
test_endpoint "WebSocket" "GET" "/api/ws" "401|400"  # 未认证也应返回非 5xx
echo ""

# ---- 4. 认证链路 ----
echo "📋 4. Auth Flow"
test_endpoint "Login (bad creds)" "POST" "/api/auth/login" "401" \
  '{"username":"smoke-test","password":"wrong"}'
echo ""

# ---- 5. 数据库连通性 ----
echo "📋 5. DB Connectivity"
# 如果 /health 返回了 DB 状态，检查它
if [ -f /tmp/smoke_response.json ]; then
  if cat /tmp/smoke_response.json | jq -e '.dependencies.database // .db // .database' 2>/dev/null | grep -qi "ok\|up\|connected"; then
    echo "  ✅ Database connected"
    PASS=$((PASS + 1))
  else
    echo "  ⚠️  Could not verify DB status from health endpoint"
  fi
fi
echo ""

# ---- Summary ----
echo "========================================"
TOTAL=$((PASS + FAIL))
if [ "${FAIL}" -eq 0 ]; then
  echo "  ✅ 全部通过 (${PASS}/${TOTAL})"
  echo "  → 可以安全推进灰度到全量"
  exit 0
else
  echo "  ❌ ${FAIL} 项失败 (${PASS}/${TOTAL})"
  echo "  → 建议回滚: helm rollback agenthive -n agenthive"
  exit 1
fi
