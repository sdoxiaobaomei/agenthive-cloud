# =============================================================================
# AgentHive Cloud — Windows 本地开发工具一键安装
# TICKET: LOCAL-DEV-SETUP
# Purpose: Install k3d + helm on Windows (PowerShell)
# Run:     .\scripts\install-local-tools.ps1
# Requires: Docker Desktop, WSL2, kubectl (already installed)
# =============================================================================

$ErrorActionPreference = "Stop"

function Install-K3d {
    Write-Host "🚀 Installing k3d..." -ForegroundColor Cyan
    
    # Check if already installed
    if (Get-Command k3d -ErrorAction SilentlyContinue) {
        Write-Host "✅ k3d already installed: $(k3d version)" -ForegroundColor Green
        return
    }
    
    # Download k3d for Windows
    $k3dUrl = "https://github.com/k3d-io/k3d/releases/download/v5.7.4/k3d-windows-amd64.exe"
    $installPath = "$env:USERPROFILE\bin"
    $exePath = "$installPath\k3d.exe"
    
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
    
    Write-Host "⬇️  Downloading k3d v5.7.4..."
    Invoke-WebRequest -Uri $k3dUrl -OutFile $exePath -UseBasicParsing
    
    # Add to PATH if not already
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$installPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
        Write-Host "⚠️  Added $installPath to PATH. Please restart your terminal." -ForegroundColor Yellow
    }
    
    Write-Host "✅ k3d installed to $exePath" -ForegroundColor Green
    & $exePath version
}

function Install-Helm {
    Write-Host "🚀 Installing Helm..." -ForegroundColor Cyan
    
    # Check if already installed
    if (Get-Command helm -ErrorAction SilentlyContinue) {
        Write-Host "✅ Helm already installed: $(helm version --short)" -ForegroundColor Green
        return
    }
    
    # Use Chocolatey if available
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "📦 Using Chocolatey to install Helm..."
        choco install kubernetes-helm -y
    }
    else {
        # Manual download
        $helmUrl = "https://get.helm.sh/helm-v3.15.4-windows-amd64.zip"
        $zipPath = "$env:TEMP\helm.zip"
        $extractPath = "$env:TEMP\helm"
        $installPath = "$env:USERPROFILE\bin"
        
        Write-Host "⬇️  Downloading Helm v3.15.4..."
        Invoke-WebRequest -Uri $helmUrl -OutFile $zipPath -UseBasicParsing
        
        Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
        Copy-Item "$extractPath\windows-amd64\helm.exe" -Destination "$installPath\helm.exe" -Force
        
        Remove-Item $zipPath -Force
        Remove-Item $extractPath -Recurse -Force
        
        # Add to PATH
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($userPath -notlike "*$installPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
            Write-Host "⚠️  Added $installPath to PATH. Please restart your terminal." -ForegroundColor Yellow
        }
    }
    
    Write-Host "✅ Helm installed" -ForegroundColor Green
    helm version
}

function Verify-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Cyan
    
    # Docker
    try {
        $dockerVersion = docker --version
        Write-Host "✅ Docker: $dockerVersion" -ForegroundColor Green
    }
    catch {
        Write-Error "❌ Docker not found. Install Docker Desktop first: https://docs.docker.com/desktop/install/windows-install/"
        exit 1
    }
    
    # WSL2
    try {
        $wslOutput = wsl -l -v
        Write-Host "✅ WSL2: Installed" -ForegroundColor Green
        Write-Host "$wslOutput"
    }
    catch {
        Write-Error "❌ WSL2 not found. Enable WSL2: wsl --install"
        exit 1
    }
    
    # kubectl
    try {
        $kubectlVersion = kubectl version --client
        Write-Host "✅ kubectl: Installed" -ForegroundColor Green
    }
    catch {
        Write-Error "❌ kubectl not found. Install kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/"
        exit 1
    }
    
    # Docker Desktop Kubernetes
    $k8sEnabled = docker info 2>$null | Select-String -Pattern "Kubernetes"
    if (-not $k8sEnabled) {
        Write-Warning "⚠️  Docker Desktop Kubernetes might not be enabled. Check Docker Desktop → Settings → Kubernetes"
    }
}

# === Main ===
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "  AgentHive Cloud — Local Dev Tools Installer" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue

Verify-Prerequisites
Install-K3d
Install-Helm

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ All tools installed!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart your terminal (to refresh PATH)" -ForegroundColor White
Write-Host "  2. Run: k3d version" -ForegroundColor White
Write-Host "  3. Run: helm version" -ForegroundColor White
Write-Host "  4. Create cluster: k3d cluster create agenthive-dev --port '8080:80@loadbalancer'" -ForegroundColor White
Write-Host "  5. Deploy: .\scripts\deploy-k3s.sh -f chart\agenthive\values.dev.yaml" -ForegroundColor White
