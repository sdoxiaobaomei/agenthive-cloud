#requires -Version 5.1
<#
.SYNOPSIS
    Configure k3d node-level registry authentication for ACR (Alibaba Cloud Container Registry).
.DESCRIPTION
    This script writes /etc/rancher/k3s/registries.yaml into each k3d node
    so containerd can pull images from the private ACR without imagePullSecrets.
    
    Usage:
        .\setup-k3d-registry.ps1 -Password (Read-Host "ACR Password" -AsSecureString)
#>
param(
    [Parameter(Mandatory)]
    [SecureString] $Password,

    [string] $Server = "crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com",
    [string] $Username = "18829355062",
    [string] $ClusterName = "agenthive-dev"
)

$plainPassword = [System.Net.NetworkCredential]::new("", $Password).Password

$registriesYaml = @"
configs:
  "$Server":
    auth:
      username: $Username
      password: $plainPassword
"@

Write-Host "Configuring k3d nodes for ACR registry auth..." -ForegroundColor Cyan

$nodes = docker ps --format "{{.Names}}" | Where-Object { $_ -like "k3d-$ClusterName-*" }

foreach ($node in $nodes) {
    Write-Host "  -> $node" -NoNewline
    docker exec $node sh -c "mkdir -p /etc/rancher/k3s" 2>$null
    $registriesYaml | docker exec -i $node sh -c "cat > /etc/rancher/k3s/registries.yaml" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAIL" -ForegroundColor Red
    }
}

Write-Host "`nRestarting containerd on all nodes..." -ForegroundColor Cyan
foreach ($node in $nodes) {
    Write-Host "  -> $node" -NoNewline
    docker exec $node sh -c "systemctl restart k3s 2>/dev/null || kill -HUP 1" 2>$null
    Write-Host " OK" -ForegroundColor Green
}

Write-Host "`nDone. ACR registry auth configured for k3d cluster '$ClusterName'." -ForegroundColor Green
Write-Host "New pods will now be able to pull images directly from ACR." -ForegroundColor Gray
