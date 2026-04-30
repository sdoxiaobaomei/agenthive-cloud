# AgentHive Cloud — Environment Validation Script (Windows)
# Usage: .\scripts\validate-env.ps1 [-EnvFile <path>]
# Default: .env.prod

param(
    [string]$EnvFile = ".env.prod"
)

$errors = 0

Write-Host "=== Validating $EnvFile ==="

if (-not (Test-Path $EnvFile)) {
    Write-Host "ERROR: File not found: $EnvFile"
    exit 1
}

$content = Get-Content $EnvFile

function Get-EnvValue($key) {
    $line = $content | Where-Object { $_ -match "^$key=(.*)$" }
    if ($line) {
        return ($line -split '=', 2)[1].Trim()
    }
    return $null
}

# ── Required variables must not be empty ──────────────────────────────
$requiredVars = @("JWT_SECRET", "DB_PASSWORD", "REDIS_PASSWORD", "GRAFANA_PASSWORD", "NACOS_AUTH_TOKEN")
foreach ($var in $requiredVars) {
    $val = Get-EnvValue $var
    if ([string]::IsNullOrWhiteSpace($val)) {
        Write-Host "ERROR: $var is empty (REQUIRED - do not leave empty in production)"
        $errors++
    }
}

# ── JWT_SECRET must be at least 32 characters ─────────────────────────
$jwtSecret = Get-EnvValue "JWT_SECRET"
if (-not [string]::IsNullOrWhiteSpace($jwtSecret) -and $jwtSecret.Length -lt 32) {
    Write-Host "ERROR: JWT_SECRET must be at least 32 characters (got $($jwtSecret.Length))"
    $errors++
}

# ── CORS_ORIGIN must not contain localhost in production ──────────────
$corsOrigin = Get-EnvValue "CORS_ORIGIN"
if (-not [string]::IsNullOrWhiteSpace($corsOrigin) -and $corsOrigin -match "localhost") {
    Write-Host "ERROR: CORS_ORIGIN contains localhost in production: $corsOrigin"
    $errors++
}

# ── No hardcoded weak / default passwords ─────────────────────────────
$weakPatterns = @(
    "<NACOS_AUTH_TOKEN_EXAMPLE>",
    "admin123",
    "123456",
    "password",
    "secret"
)

foreach ($pattern in $weakPatterns) {
    $matches = $content | Where-Object { $_ -match "^[A-Z_]+=.*$pattern" }
    if ($matches) {
        Write-Host "WARNING: Potential weak password detected containing '$pattern'"
    }
}

# ── No real API keys committed ────────────────────────────────────────
$apiKeyMatches = $content | Where-Object { $_ -match "sk-kimi-[A-Za-z0-9]{20,}" }
if ($apiKeyMatches) {
    Write-Host "ERROR: Real LLM API key (sk-kimi-...) detected in $EnvFile"
    $errors++
}

# ── Result ────────────────────────────────────────────────────────────
if ($errors -eq 0) {
    Write-Host "OK: Validation passed."
    exit 0
} else {
    Write-Host "FAIL: $errors error(s) found."
    exit 1
}
