#!/usr/bin/env pwsh
#requires -Version 7.0
<#
.SYNOPSIS
    CI 构建测试脚本 - 模拟从纯净 Git 分支开始的完整构建流程

.DESCRIPTION
    1. 检�?Git 状态是否干净
    2. 清理所有编译残留（node_modules, dist, .output, Docker 镜像等）
    3. �?Git 克隆/拉取最新代�?    4. 执行完整 CI 流程：安装依�?�?构建 �?Docker 镜像
    5. 验证构建结果

.PARAMETER CleanGit
    如果指定，会清理未跟踪的文件（危险操作！�?
.EXAMPLE
    .\Test-CiBuild.ps1
    
.EXAMPLE
    .\Test-CiBuild.ps1 -CleanGit -Verbose
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$CleanGit,
    [switch]$SkipDocker
)

#region Configuration
$ErrorActionPreference = 'Stop'
$script:ProjectName = "agenthive-cloud"
$script:ProjectPath = Join-Path -Path $PSScriptRoot -ChildPath "..\$script:ProjectName"
$script:TestResults = @{
    StepsCompleted = @()
    Errors = @()
    Warnings = @()
}
#endregion

#region Helper Functions
function Write-Step {
    param([int]$StepNumber, [string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Step $StepNumber/7: $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-SubStep {
    param([string]$Message)
    Write-Host "  �?$Message" -ForegroundColor Gray
}

function Test-Step {
    param(
        [string]$StepName,
        [scriptblock]$Action
    )
    try {
        Write-SubStep -Message "执行: $StepName"
        & $Action
        $script:TestResults.StepsCompleted += $StepName
        Write-Host "  �?成功" -ForegroundColor Green
        return $true
    }
    catch {
        $script:TestResults.Errors += "$StepName : $_"
        Write-Host "  �?失败: $_" -ForegroundColor Red
        return $false
    }
}
#endregion

#region Step 1: Check Git Status
Write-Step -StepNumber 1 -Message "检�?Git 状�?

Test-Step -StepName "检查是否在 Git 仓库�? -Action {
    Set-Location $script:ProjectPath
    $gitStatus = git status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Not a git repository"
    }
}

Test-Step -StepName "检查分�? -Action {
    $branch = git rev-parse --abbrev-ref HEAD
    Write-Host "    当前分支: $branch" -ForegroundColor Yellow
}

$uncommitted = git status --porcelain
if ($uncommitted) {
    Write-Warning "有未提交的更�?"
    $uncommitted | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    
    if ($CleanGit -and $PSCmdlet.ShouldProcess("清理未跟踪的文件", "Git Clean")) {
        Test-Step -StepName "清理 Git 工作�? -Action {
            git reset --hard
            git clean -fdx
        }
    }
}
else {
    Write-Host "  �?Git 工作区干净" -ForegroundColor Green
}

#endregion

#region Step 2: Clean Build Artifacts
Write-Step -StepNumber 2 -Message "清理编译残留"

$cleanPaths = @(
    "node_modules",
    "apps/*/node_modules",
    "packages/*/node_modules",
    "apps/api/dist",
    "apps/landing/.output",
    "apps/landing/dist",
    "apps/agent-runtime/dist",
    "packages/types/dist",
    ".nuxt",
    ".turbo",
    "*.log",
    ".cache"
)

foreach ($path in $cleanPaths) {
    $fullPath = Join-Path -Path $script:ProjectPath -ChildPath $path
    if (Test-Path -Path $fullPath) {
        Test-Step -StepName "删除 $path" -Action {
            Remove-Item -Path $fullPath -Recurse -Force -ErrorAction Stop
        }
    }
}

# Clean Docker
if (-not $SkipDocker) {
    Test-Step -StepName "清理 Docker 构建缓存" -Action {
        docker builder prune -f 2>&1 | Out-Null
    }
    
    # Remove old agenthive images
    $oldImages = docker images --filter "reference=*agenthive*" -q
    if ($oldImages) {
        Test-Step -StepName "删除�?Docker 镜像" -Action {
            $oldImages | ForEach-Object { docker rmi $_ -f 2>&1 | Out-Null }
        }
    }
}

#endregion

#region Step 3: Fresh Git Pull
Write-Step -StepNumber 3 -Message "拉取最新代�?

Test-Step -StepName "Git Pull" -Action {
    Set-Location $script:ProjectPath
    $pullOutput = git pull origin $(git rev-parse --abbrev-ref HEAD) 2>&1
    Write-Verbose $pullOutput
}

#endregion

#region Step 4: Install Dependencies
Write-Step -StepNumber 4 -Message "安装依赖"

Set-Location $script:ProjectPath

Test-Step -StepName "检�?pnpm" -Action {
    $pnpmVersion = pnpm --version 2>&1
    Write-Host "    pnpm version: $pnpmVersion" -ForegroundColor Gray
}

Test-Step -StepName "pnpm install" -Action {
    $installOutput = pnpm install 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm install failed"
    }
    Write-Verbose $installOutput
}

#endregion

#region Step 5: Build Applications
Write-Step -StepNumber 5 -Message "构建应用程序"

$buildOrder = @(
    @{ Path = "packages/types"; Name = "types package" },
    @{ Path = "apps/agent-runtime"; Name = "agent-runtime" },
    @{ Path = "apps/api"; Name = "api" },
    @{ Path = "apps/landing"; Name = "landing" }
)

foreach ($app in $buildOrder) {
    $appPath = Join-Path -Path $script:ProjectPath -ChildPath $app.Path
    
    if (Test-Path (Join-Path -Path $appPath -ChildPath "package.json")) {
        Set-Location $appPath
        
        Test-Step -StepName "构建 $($app.Name)" -Action {
            $buildOutput = pnpm build 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed for $($app.Name)"
            }
        }
        
        # Verify build output
        $distPath = Join-Path -Path $appPath -ChildPath "dist"
        $outputPath = Join-Path -Path $appPath -ChildPath ".output"
        
        if (-not (Test-Path $distPath) -and -not (Test-Path $outputPath)) {
            $script:TestResults.Warnings += "No build output found for $($app.Name)"
        }
    }
}

#endregion

#region Step 6: Build Docker Images
if (-not $SkipDocker) {
    Write-Step -StepNumber 6 -Message "构建 Docker 镜像"
    
    Set-Location (Split-Path -Parent $script:ProjectPath)
    
    $dockerImages = @(
        @{ Name = "api"; Dockerfile = "apps/api/Dockerfile.minimal"; Tag = "agenthive-api:test" },
        @{ Name = "landing"; Dockerfile = "apps/landing/Dockerfile.minimal"; Tag = "agenthive-landing:test" }
    )
    
    foreach ($image in $dockerImages) {
        Test-Step -StepName "构建 $($image.Name) 镜像" -Action {
            $dockerfilePath = Join-Path -Path $script:ProjectName -ChildPath $image.Dockerfile
            
            if (-not (Test-Path $dockerfilePath)) {
                throw "Dockerfile not found: $($image.Dockerfile)"
            }
            
            $buildCmd = "docker build -t $($image.Tag) -f $dockerfilePath $($script:ProjectName)"
            Write-Verbose "Running: $buildCmd"
            
            Invoke-Expression $buildCmd
            
            if ($LASTEXITCODE -ne 0) {
                throw "Docker build failed for $($image.Name)"
            }
        }
        
        # Verify image
        Test-Step -StepName "验证 $($image.Name) 镜像" -Action {
            $imageInfo = docker images $($image.Tag) --format "{{.Repository}}:{{.Tag}} {{.Size}}"
            if (-not $imageInfo) {
                throw "Image not found: $($image.Tag)"
            }
            Write-Host "    Created: $imageInfo" -ForegroundColor Gray
        }
    }
}
else {
    Write-Step -StepNumber 6 -Message "跳过 Docker 构建"
    Write-Host "  (使用 -SkipDocker 参数跳过)" -ForegroundColor Yellow
}

#endregion

#region Step 7: Verify Results
Write-Step -StepNumber 7 -Message "验证结果"

Write-Host "`n构建完成的步�?" -ForegroundColor Cyan
$script:TestResults.StepsCompleted | ForEach-Object { 
    Write-Host "  �?$_" -ForegroundColor Green 
}

if ($script:TestResults.Warnings.Count -gt 0) {
    Write-Host "`n警告:" -ForegroundColor Yellow
    $script:TestResults.Warnings | ForEach-Object { 
        Write-Host "  �?$_" -ForegroundColor Yellow 
    }
}

if ($script:TestResults.Errors.Count -gt 0) {
    Write-Host "`n错误:" -ForegroundColor Red
    $script:TestResults.Errors | ForEach-Object { 
        Write-Host "  �?$_" -ForegroundColor Red 
    }
    
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "  CI 测试失败!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

# Final verification
Write-Host "`n最终验�?" -ForegroundColor Cyan

# Check node_modules exists
$nodeModulesExists = Test-Path (Join-Path -Path $script:ProjectPath -ChildPath "node_modules")
Write-Host "  node_modules: $(if($nodeModulesExists){'�?}else{'�?})" -ForegroundColor $(if($nodeModulesExists){'Green'}else{'Red'})

# Check API dist
$apiDistExists = Test-Path (Join-Path -Path $script:ProjectPath -ChildPath "apps/api/dist")
Write-Host "  API dist: $(if($apiDistExists){'�?}else{'�?})" -ForegroundColor $(if($apiDistExists){'Green'}else{'Red'})

# Check Landing output
$landingOutputExists = Test-Path (Join-Path -Path $script:ProjectPath -ChildPath "apps/landing/.output")
Write-Host "  Landing .output: $(if($landingOutputExists){'�?}else{'�?})" -ForegroundColor $(if($landingOutputExists){'Green'}else{'Red'})

if (-not $SkipDocker) {
    # Check Docker images
    $apiImageExists = docker images agenthive-api:test --format "{{.ID}}"
    $landingImageExists = docker images agenthive-landing:test --format "{{.ID}}"
    
    Write-Host "  Docker API image: $(if($apiImageExists){'�?}else{'�?})" -ForegroundColor $(if($apiImageExists){'Green'}else{'Red'})
    Write-Host "  Docker Landing image: $(if($landingImageExists){'�?}else{'�?})" -ForegroundColor $(if($landingImageExists){'Green'}else{'Red'})
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  CI 测试通过!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

#endregion
