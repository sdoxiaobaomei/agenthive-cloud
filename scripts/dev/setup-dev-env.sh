#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — Development Environment Setup
# TICKET: TICKET-PLAT-DEV-003
# Purpose: Verify required env vars in .env.dev and auto-generate secrets.
# Usage  : bash scripts/setup-dev-env.sh
# =============================================================================
set -euo pipefail

ENV_FILE=".env.dev"
REQUIRED_VARS=(
  DB_USER
  DB_PASSWORD
  DB_NAME
  REDIS_PASSWORD
  JWT_SECRET
  LLM_API_KEY
  RABBITMQ_USER
  RABBITMQ_PASSWORD
  NACOS_AUTH_TOKEN
  NACOS_AUTH_IDENTITY_VALUE
  NACOS_PASSWORD
)

# ---------------------------------------------------------------------------
# 1. Ensure .env.dev exists
# ---------------------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[INFO] $ENV_FILE not found. Creating empty file."
  touch "$ENV_FILE"
fi

# ---------------------------------------------------------------------------
# 2. Detect missing / empty variables
# ---------------------------------------------------------------------------
missing_vars=()

for var in "${REQUIRED_VARS[@]}"; do
  # Look for a line that starts with VARNAME= (ignoring comments)
  if ! grep -qE "^${var}=" "$ENV_FILE"; then
    missing_vars+=("$var")
  else
    # Extract value after first '=' and trim whitespace / quotes
    value=$(grep -E "^${var}=" "$ENV_FILE" | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"' | tr -d "'")
    if [[ -z "$value" ]]; then
      missing_vars+=("$var")
    fi
  fi
done

if [[ ${#missing_vars[@]} -eq 0 ]]; then
  echo "[OK] All required environment variables are present and non-empty in $ENV_FILE."
  exit 0
fi

echo "[WARN] The following required variables are missing or empty in $ENV_FILE:"
for var in "${missing_vars[@]}"; do
  echo "  - $var"
done

# ---------------------------------------------------------------------------
# 3. Auto-generate / suggest values
# ---------------------------------------------------------------------------
for var in "${missing_vars[@]}"; do
  case "$var" in
    JWT_SECRET)
      # Generate a 256-bit (32-byte) random secret encoded as base64
      generated_value=$(openssl rand -base64 32)
      echo "[AUTO] Generated random 256-bit base64 JWT_SECRET."
      echo "JWT_SECRET=${generated_value}" >> "$ENV_FILE"
      ;;

    DB_USER)
      echo "[WARN] $var is missing. Example: DB_USER=agenthive"
      echo "# DB_USER=agenthive   # <-- set this or use default in docker-compose" >> "$ENV_FILE"
      ;;

    DB_PASSWORD)
      echo "[WARN] $var is missing. Example: DB_PASSWORD=dev"
      echo "# DB_PASSWORD=dev   # <-- set this or use default in docker-compose" >> "$ENV_FILE"
      ;;

    DB_NAME)
      echo "[WARN] $var is missing. Example: DB_NAME=agenthive"
      echo "# DB_NAME=agenthive   # <-- set this or use default in docker-compose" >> "$ENV_FILE"
      ;;

    REDIS_PASSWORD)
      echo "[WARN] $var is missing. Example: REDIS_PASSWORD=agenthive"
      echo "# REDIS_PASSWORD=agenthive   # <-- required, no docker-compose default for api service" >> "$ENV_FILE"
      ;;

    LLM_API_KEY)
      echo "[WARN] $var is missing. Example: LLM_API_KEY=your-llm-api-key"
      echo "# LLM_API_KEY=<GENERATE>   # <-- replace with your actual LLM API key" >> "$ENV_FILE"
      ;;

    RABBITMQ_USER)
      echo "[WARN] $var is missing. Example: RABBITMQ_USER=agenthive"
      echo "# RABBITMQ_USER=agenthive   # <-- set this or use default in docker-compose" >> "$ENV_FILE"
      ;;

    RABBITMQ_PASSWORD)
      echo "[WARN] $var is missing. Example: RABBITMQ_PASSWORD=agenthive-secret"
      echo "# RABBITMQ_PASSWORD=agenthive-secret   # <-- set this or use default in docker-compose" >> "$ENV_FILE"
      ;;

    NACOS_AUTH_TOKEN)
      # Generate a 256-bit (32-byte) random secret encoded as base64
      generated_value=$(openssl rand -base64 32)
      echo "[AUTO] Generated random 256-bit base64 NACOS_AUTH_TOKEN."
      echo "NACOS_AUTH_TOKEN=${generated_value}" >> "$ENV_FILE"
      ;;

    NACOS_AUTH_IDENTITY_VALUE)
      # Generate a 32-character random alphanumeric string
      generated_value=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
      echo "[AUTO] Generated random 32-char alphanumeric NACOS_AUTH_IDENTITY_VALUE."
      echo "NACOS_AUTH_IDENTITY_VALUE=${generated_value}" >> "$ENV_FILE"
      ;;

    NACOS_PASSWORD)
      echo "[WARN] $var is missing. Using default: agenthive-secret-2024"
      echo "NACOS_PASSWORD=agenthive-secret-2024" >> "$ENV_FILE"
      ;;

    *)
      echo "[WARN] $var is missing. Please set it manually."
      echo "# ${var}=   # <-- fill in manually" >> "$ENV_FILE"
      ;;
  esac
done

# ---------------------------------------------------------------------------
# 4. OpenTelemetry / Observability hints (optional)
# ---------------------------------------------------------------------------
if ! grep -qE "^OTEL_EXPORTER_OTLP_ENDPOINT=" "$ENV_FILE"; then
  echo ""
  echo "# OpenTelemetry OTLP endpoint (defaults to http://otel-collector:4317 in docker-compose)" >> "$ENV_FILE"
  echo "# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317   # <-- use this for local non-Docker dev" >> "$ENV_FILE"
fi
if ! grep -qE "^OTEL_LOG_LEVEL=" "$ENV_FILE"; then
  echo "# OTEL_LOG_LEVEL=info   # <-- set to 'debug' for verbose OTel SDK logs" >> "$ENV_FILE"
fi

echo "[DONE] Review $ENV_FILE and uncomment or adjust the placeholder values."
echo "       JWT_SECRET has already been written as an active (uncommented) value."
echo "       NACOS_AUTH_TOKEN has already been written as an active (uncommented) value."
echo "       NACOS_AUTH_IDENTITY_VALUE has already been written as an active (uncommented) value."
echo "       NACOS_PASSWORD has already been written as an active (uncommented) value."
echo ""
echo "[INFO] OpenTelemetry instrumentation is now enabled by default for Java services."
echo "       Start the monitoring profile to view traces:"
echo "       docker compose -f docker-compose.dev.yml --env-file .env.dev --profile monitoring up -d"
