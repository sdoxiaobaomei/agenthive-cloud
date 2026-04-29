# =============================================================================
# AgentHive Cloud - E2E Smoke Test (PowerShell)
# TICKET: TICKET-E2E-001
# Purpose: Automated acceptance test for dev environment rebuild
# Usage  : .\scripts\e2e-smoke-test.ps1
# =============================================================================
$ErrorActionPreference = "Stop"

$RED    = "$([char]0x1B)[0;31m"
$GREEN  = "$([char]0x1B)[0;32m"
$YELLOW = "$([char]0x1B)[1;33m"
$BOLD   = "$([char]0x1B)[1m"
$NC     = "$([char]0x1B)[0m"

$PASS  = 0
$FAIL  = 0
$TOTAL = 0
$ERRORS = @()

$REQUIRED_CONTAINERS = @(
  "agenthive-landing-dev"
  "agenthive-nginx-dev"
  "agenthive-gateway-dev"
  "agenthive-auth-dev"
  "agenthive-user-dev"
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

$TEST_USER   = "e2e_smoke_user_ps"
$TEST_PASS   = "SmokeTest123!"
$TEST_EMAIL  = "smoke_ps@test.com"
$API_BASE    = "http://localhost:8080"
$LANDING_URL = "http://localhost:3000"

function Die($msg)  { Write-Host "${RED}FAIL${NC}  $msg"; $script:ERRORS += $msg; $script:FAIL++; $script:TOTAL++ }
function Ok($msg)   { Write-Host "${GREEN}PASS${NC}  $msg"; $script:PASS++; $script:TOTAL++ }
function Warn($msg) { Write-Host "${YELLOW}WARN${NC}  $msg" }

# ---------------------------------------------------------------------------
# 1. Container Health Check
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} 1. Container Health Check${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

foreach ($container in $REQUIRED_CONTAINERS) {
  $status = docker ps --filter "name=$container" --format '{{.Status}}' 2>$null
  if (-not $status) {
    Die("[$container] not found")
  } elseif ($status -like "*unhealthy*") {
    Die("[$container] unhealthy: $status")
  } elseif ($status -like "*healthy*" -or $status -like "*Up*") {
    Ok("[$container] $status")
  } else {
    Warn("[$container] $status")
  }
}

# ---------------------------------------------------------------------------
# 2. Register test user (idempotent)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} 2. Register Test User${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

try {
  $regBody = @{ username = $TEST_USER; password = $TEST_PASS; email = $TEST_EMAIL } | ConvertTo-Json -Compress
  $regResp = Invoke-WebRequest -Uri "${API_BASE}/api/auth/register" -Method POST -ContentType "application/json" -Body $regBody -UseBasicParsing -ErrorAction Stop
  if ($regResp.Content -like '*"code":200*') {
    Ok("[Register] User created successfully")
  } else {
    Warn("[Register] Unexpected response: $($regResp.Content)")
  }
} catch {
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $errBody = $reader.ReadToEnd()
    if ($errBody -like "*already exists*" -or $errBody -like "*Duplicate*") {
      Ok("[Register] User already exists (idempotent)")
    } else {
      Warn("[Register] Unexpected response: $errBody")
    }
  } else {
    Warn("[Register] Exception: $_")
  }
}

# ---------------------------------------------------------------------------
# 3. Login Test
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} 3. Login Test${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

$loginBody = @{ username = $TEST_USER; password = $TEST_PASS } | ConvertTo-Json -Compress
try {
  $loginResp = Invoke-WebRequest -Uri "${API_BASE}/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing -ErrorAction Stop
  if ($loginResp.Content -like '*"code":200*') {
    Ok("[Login] HTTP 200 with token")
  } else {
    Die("[Login] Failed: $($loginResp.Content)")
  }
  $loginJson = $loginResp.Content | ConvertFrom-Json
  $ACCESS_TOKEN = $loginJson.data.accessToken
  if (-not $ACCESS_TOKEN) {
    Die("[Login] accessToken not found in response")
  } else {
    Ok("[Login] accessToken extracted")
  }
} catch {
  Die("[Login] Failed: $_")
}

# ---------------------------------------------------------------------------
# 4. Token Subject Check (numeric, not UUID)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} 4. Token Subject Check${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

$parts = $ACCESS_TOKEN -split '\.'
$payloadB64 = $parts[1]
# Pad base64
$padLen = 4 - ($payloadB64.Length % 4)
if ($padLen -ne 4) { $payloadB64 += '=' * $padLen }
$payloadBytes = [System.Convert]::FromBase64String($payloadB64)
$payloadJson = [System.Text.Encoding]::UTF8.GetString($payloadBytes) | ConvertFrom-Json
$sub = $payloadJson.sub

if (-not $sub) {
  Die("[Token] subject not found in JWT payload")
} elseif ($sub -match '^\d+$') {
  Ok("[Token] subject is numeric: $sub")
} else {
  Die("[Token] subject is NOT numeric (UUID?): $sub")
}

# ---------------------------------------------------------------------------
# 5. /me Endpoint Test
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} 5. /me Endpoint Test${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

try {
  $meResp = Invoke-WebRequest -Uri "${API_BASE}/api/auth/me" -Headers @{"Authorization" = "Bearer $ACCESS_TOKEN"} -UseBasicParsing -ErrorAction Stop
  if ($meResp.Content -like '*"code":200*') {
    Ok("[/me] HTTP 200 with user data")
  } else {
    Die("[/me] Failed: $($meResp.Content)")
  }
  if ($meResp.Content -like '*"username"*') {
    Ok("[/me] Contains username field")
  } else {
    Die("[/me] Missing username field")
  }
} catch {
  Die("[/me] Failed: $_")
}

# ---------------------------------------------------------------------------
# 6. Frontend Landing Test
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} 6. Frontend Landing Test${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

try {
  $landingResp = Invoke-WebRequest -Uri "${LANDING_URL}/" -UseBasicParsing -ErrorAction Stop
  if ($landingResp.StatusCode -eq 200) {
    Ok("[Landing] HTTP 200")
  } else {
    Die("[Landing] HTTP $($landingResp.StatusCode)")
  }
} catch {
  Die("[Landing] Failed: $_")
}

# ---------------------------------------------------------------------------
# 7. Docker Compose "variable is not set" Check
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} 7. Docker Compose Variable Check${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

$composeOut = docker compose -f docker-compose.dev.yml --env-file .env.dev config 2>&1
$varWarnings = ($composeOut | Select-String "variable is not set").Count
if ($varWarnings -eq 0) {
  Ok("[Config] No 'variable is not set' warnings")
} else {
  Die("[Config] Found $varWarnings 'variable is not set' warnings")
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host "${BOLD} E2E Smoke Test Summary${NC}"
Write-Host "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
Write-Host ("  {0,-20} {1}" -f "Total checks:", $TOTAL)
Write-Host ("  {0,-20} {1}" -f "Passed:", $PASS)
Write-Host ("  {0,-20} {1}" -f "Failed:", $FAIL)

if ($FAIL -gt 0) {
  Write-Host ""
  Write-Host "${RED}${BOLD} Details:${NC}"
  foreach ($err in $ERRORS) {
    Write-Host "  - $err"
  }
  Write-Host ""
  Write-Host "${RED}${BOLD} OVERALL: FAIL${NC}"
  exit 1
} else {
  Write-Host ""
  Write-Host "${GREEN}${BOLD} OVERALL: PASS${NC}"
  exit 0
}
