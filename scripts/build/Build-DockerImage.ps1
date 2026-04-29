#!/usr/bin/env pwsh
#requires -Version 7.0
<#
.SYNOPSIS
    Builds Docker images for AgentHive applications.

.DESCRIPTION
    This script builds Docker images for the API and Landing applications.
    It supports custom registries, tags, and optional push to registry.

.PARAMETER Registry
    The Docker registry URL. If not specified, images will be built with local names only.

.PARAMETER Tag
    The image tag. Defaults to the short Git commit hash, or "latest" if not in a Git repository.

.PARAMETER Push
    If specified, pushes the images to the registry after building.

.PARAMETER App
    Specific app to build (api or landing). If not specified, builds all apps.

.EXAMPLE
    .\Build-DockerImage.ps1
    Builds images with default settings (local names, git commit tag).

.EXAMPLE
    .\Build-DockerImage.ps1 -Registry "registry.example.com" -Tag "v1.0.0" -Push
    Builds and pushes images to the specified registry with tag v1.0.0.

.EXAMPLE
    .\Build-DockerImage.ps1 -App "api"
    Builds only the API image.

.NOTES
    File Name      : Build-DockerImage.ps1
    Author         : AgentHive Team
    Prerequisite   : PowerShell 7.0+, Docker
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(HelpMessage = "Docker registry URL")]
    [ValidateNotNullOrEmpty()]
    [string]$Registry,

    [Parameter(HelpMessage = "Image tag")]
    [ValidateNotNullOrEmpty()]
    [string]$Tag,

    [Parameter(HelpMessage = "Push images to registry")]
    [switch]$Push,

    [Parameter(HelpMessage = "Specific app to build (api or landing)")]
    [ValidateSet("api", "landing")]
    [string]$App
)

#region Configuration
$ErrorActionPreference = 'Stop'
$script:ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$script:Apps = if ($App) { @($App) } else { @("api", "landing") }
$script:DockerfileMap = @{
    "api"     = "apps/api/Dockerfile.minimal"
    "landing" = "apps/landing/Dockerfile.minimal"
}
#endregion

#region Helper Functions
function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        
        [Parameter()]
        [ValidateSet("Info", "Success", "Warning", "Error")]
        [string]$Level = "Info"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $prefix = "[$timestamp]"
    
    switch ($Level) {
        "Info"    { Write-Host "$prefix [INFO] $Message" -ForegroundColor Cyan }
        "Success" { Write-Host "$prefix [OK] $Message" -ForegroundColor Green }
        "Warning" { Write-Warning "$Message" }
        "Error"   { Write-Error "$Message" }
    }
}

function Test-DockerEnvironment {
    [CmdletBinding()]
    param()
    
    Write-Log -Message "Checking Docker environment..."
    
    # Check if Docker command exists
    $dockerCommand = Get-Command -Name "docker" -ErrorAction SilentlyContinue
    if (-not $dockerCommand) {
        throw "Docker command not found. Please install Docker."
    }
    
    # Check if Docker daemon is running
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Docker daemon is not running."
        }
    }
    catch {
        throw "Failed to connect to Docker: $_"
    }
    
    Write-Log -Message "Docker environment OK" -Level "Success"
}

function Get-ImageTag {
    [CmdletBinding()]
    param()
    
    if ($Tag) {
        return $Tag
    }
    
    try {
        $gitHash = git rev-parse --short HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $gitHash) {
            Write-Log -Message "Using Git commit hash as tag: $gitHash"
            return $gitHash
        }
    }
    catch {
        Write-Verbose "Git command failed: $_"
    }
    
    Write-Log -Message "Using default tag: latest" -Level "Warning"
    return "latest"
}

function Get-ImageName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$AppName,
        
        [Parameter(Mandatory)]
        [string]$ImageTag
    )
    
    $baseName = "agenthive-$AppName"
    
    if ($Registry) {
        return "$Registry/$baseName`:$ImageTag"
    }
    
    return "$baseName`:$ImageTag"
}

function Build-AppImage {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$AppName,
        
        [Parameter(Mandatory)]
        [string]$ImageName
    )
    
    $dockerfile = $script:DockerfileMap[$AppName]
    $dockerfilePath = Join-Path -Path $script:ProjectRoot -ChildPath $dockerfile
    
    if (-not (Test-Path -Path $dockerfilePath)) {
        throw "Dockerfile not found: $dockerfilePath"
    }
    
    Write-Log -Message "Building $AppName image: $ImageName"
    
    $buildArgs = @(
        "build",
        "-t", $ImageName,
        "-f", $dockerfilePath,
        (Join-Path -Path $script:ProjectRoot -ChildPath "agenthive-cloud")
    )
    
    if ($PSCmdlet.ShouldProcess($ImageName, "Build Docker image")) {
        & docker @buildArgs
        
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed for $AppName with exit code $LASTEXITCODE"
        }
        
        Write-Log -Message "$AppName build completed" -Level "Success"
    }
}

function Add-LatestTag {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$SourceImage,
        
        [Parameter(Mandatory)]
        [string]$AppName
    )
    
    $latestName = if ($Registry) { 
        "$Registry/agenthive-$AppName`:latest" 
    } else { 
        "agenthive-$AppName`:latest" 
    }
    
    Write-Log -Message "Tagging $SourceImage as $latestName"
    docker tag $SourceImage $latestName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Log -Message "Failed to tag $SourceImage" -Level "Warning"
    }
}

function Publish-Image {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$ImageName
    )
    
    if (-not $PSCmdlet.ShouldProcess($ImageName, "Push to registry")) {
        return
    }
    
    Write-Log -Message "Pushing $ImageName"
    docker push $ImageName
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to push image: $ImageName"
    }
}

function Show-Summary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$BuiltImages
    )
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  Build Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Built Images:" -ForegroundColor Cyan
    foreach ($app in $BuiltImages.Keys) {
        Write-Host "  $app : $($BuiltImages[$app])"
    }
    
    Write-Host ""
    Write-Host "Local Run Commands:" -ForegroundColor Cyan
    if ($BuiltImages.ContainsKey("api")) {
        Write-Host "  docker run -p 3001:3001 $($BuiltImages["api"])"
    }
    if ($BuiltImages.ContainsKey("landing")) {
        Write-Host "  docker run -p 80:80 $($BuiltImages["landing"])"
    }
    
    Write-Host ""
    Write-Host "Docker Images:" -ForegroundColor Cyan
    docker images --filter "reference=*agenthive*" --format "table {{.Repository}}:{{.Tag}}	{{.Size}}" | Select-Object -First 10
}
#endregion

#region Main Execution
try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  AgentHive Docker Build" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Validation
    Test-DockerEnvironment
    
    if ($Push -and -not $Registry) {
        throw "Cannot push images: Registry parameter is required."
    }
    
    # Determine tag
    $imageTag = Get-ImageTag
    
    # Build images
    $builtImages = @{}
    
    foreach ($app in $script:Apps) {
        Write-Host ""
        Write-Host "----------------------------------------" -ForegroundColor Gray
        
        $imageName = Get-ImageName -AppName $app -ImageTag $imageTag
        Build-AppImage -AppName $app -ImageName $imageName
        Add-LatestTag -SourceImage $imageName -AppName $app
        
        $builtImages[$app] = $imageName
        
        # Push if requested
        if ($Push) {
            Publish-Image -ImageName $imageName
            
            $latestName = if ($Registry) { "$Registry/agenthive-$app`:latest" } else { "agenthive-$app`:latest" }
            Publish-Image -ImageName $latestName
        }
    }
    
    # Summary
    Show-Summary -BuiltImages $builtImages
}
catch {
    Write-Log -Message "Build failed: $_" -Level "Error"
    exit 1
}
#endregion
