# =============================================================================
# Bump Version Script - Semantic Versioning (PowerShell)
# Usage: .\scripts\bump-version.ps1 [patch|minor|major]
# Example: .\scripts\bump-version.ps1 patch  → v0.0.1
#          .\scripts\bump-version.ps1 minor  → v0.1.0
#          .\scripts\bump-version.ps1 major  → v1.0.0
# =============================================================================

param(
    [Parameter()]
    [ValidateSet("patch", "minor", "major")]
    [string]$Type = "patch"
)

# Get current version from latest v* tag
$CurrentTag = (git describe --tags --match "v*" --abbrev=0 2>$null)
if (-not $CurrentTag) {
    $Current = "0.0.0"
} else {
    $Current = $CurrentTag -replace "^v", ""
}

$Parts = $Current -split "\."
[int]$Major = $Parts[0]
[int]$Minor = $Parts[1]
[int]$Patch = $Parts[2]

switch ($Type) {
    "major" { $Major++; $Minor = 0; $Patch = 0 }
    "minor" { $Minor++; $Patch = 0 }
    "patch" { $Patch++ }
}

$New = "v${Major}.${Minor}.${Patch}"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 AgentHive Cloud Version Bump" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Current: v$Current"
Write-Host "  Type:    $Type"
Write-Host "  New:     $New" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

$Confirm = Read-Host "Proceed? [y/N]"
if ($Confirm -notmatch "^[Yy]$") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "📌 Creating annotated tag..."
git tag -a "$New" -m "Release $New"

Write-Host "📤 Pushing tag to origin..."
git push origin "$New"

Write-Host ""
Write-Host "✅ Tag $New pushed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "CI will now build and push images with tag: $New"
Write-Host ""
Write-Host "To deploy this version, update .env.prod:"
Write-Host "  API_IMAGE=crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/api:$New"
Write-Host "  LANDING_IMAGE=crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/landing:$New"
Write-Host "  ..."
