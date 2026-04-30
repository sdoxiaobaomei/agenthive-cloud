#!/bin/bash
set -euo pipefail

# AgentHive Cloud �?Environment Validation Script
# Usage: bash scripts/validate-env.sh [path-to-env-file]
# Default: .env.prod

ENV_FILE="${1:-.env.prod}"
ERRORS=0

echo "=== Validating $ENV_FILE ==="

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: File not found: $ENV_FILE"
    exit 1
fi

# Helper: get value for a key
_get_val() {
    grep "^${1}=" "$ENV_FILE" | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true
}

# ── Required variables must not be empty ──────────────────────────────
REQUIRED_VARS=(
    "JWT_SECRET"
    "DB_PASSWORD"
    "REDIS_PASSWORD"
    "GRAFANA_PASSWORD"
    "NACOS_AUTH_TOKEN"
)

for var in "${REQUIRED_VARS[@]}"; do
    val=$(_get_val "$var")
    if [ -z "$val" ]; then
        echo "ERROR: $var is empty (REQUIRED - do not leave empty in production)"
        ERRORS=$((ERRORS + 1))
    fi
done

# ── JWT_SECRET must be at least 32 characters ─────────────────────────
JWT_SECRET=$(_get_val "JWT_SECRET")
if [ -n "$JWT_SECRET" ] && [ ${#JWT_SECRET} -lt 32 ]; then
    echo "ERROR: JWT_SECRET must be at least 32 characters (got ${#JWT_SECRET})"
    ERRORS=$((ERRORS + 1))
fi

# ── CORS_ORIGIN must not contain localhost in production ──────────────
CORS_ORIGIN=$(_get_val "CORS_ORIGIN")
if [ -n "$CORS_ORIGIN" ] && echo "$CORS_ORIGIN" | grep -qi "localhost"; then
    echo "ERROR: CORS_ORIGIN contains localhost in production: $CORS_ORIGIN"
    ERRORS=$((ERRORS + 1))
fi

# ── No hardcoded weak / default passwords ─────────────────────────────
WEAK_PATTERNS=(
    "<NACOS_AUTH_TOKEN_EXAMPLE>"
    "admin123"
    "123456"
    "password"
    "secret"
)

for pattern in "${WEAK_PATTERNS[@]}"; do
    if grep -qiE "^[A-Z_]+=.*${pattern}" "$ENV_FILE"; then
        echo "WARNING: Potential weak password detected containing '${pattern}'"
    fi
done

# ── No real API keys committed ────────────────────────────────────────
if grep -qE "sk-kimi-[A-Za-z0-9]{20,}" "$ENV_FILE"; then
    echo "ERROR: Real LLM API key (sk-kimi-...) detected in $ENV_FILE"
    ERRORS=$((ERRORS + 1))
fi

# ── Result ────────────────────────────────────────────────────────────
if [ $ERRORS -eq 0 ]; then
    echo "OK: Validation passed."
    exit 0
else
    echo "FAIL: $ERRORS error(s) found."
    exit 1
fi
