# AgentHive 安全组最小权限加固脚本
# 运行前请确认你的公网 IP：curl -s ip.sb
# 
# 用法:
#   .\security-group-hardening.ps1 -MyPublicIP "123.45.67.89"
#
# 规则说明:
#   2C2G 数据层 (sg-2ze2n88fyedc7ryofiq2): 仅允许 8C16G 内网访问数据库
#   8C16G 业务层 (sg-2ze340kabv3u05au7c2w): 仅允许 HTTP/HTTPS/你的IP-SSH

param(
    [Parameter(Mandatory=$true)]
    [string]$MyPublicIP
)

$ErrorActionPreference = "Stop"

Write-Host "=== AgentHive 安全组最小权限加固 ===" -ForegroundColor Cyan
Write-Host "你的公网 IP: $MyPublicIP" -ForegroundColor Yellow
Write-Host ""

# ==========================================
# 1. 加固 2C2G 数据层 (i-2ze6xoqzescvry5s0dpy)
# ==========================================
Write-Host "--- 加固 2C2G 数据层安全组 (sg-2ze2n88fyedc7ryofiq2) ---" -ForegroundColor Green

# 1.1 删除所有 0.0.0.0/0 的危险规则
$dangerousRules = @(
    @{ IpProtocol="tcp"; PortRange="22/22"; SourceCidrIp="0.0.0.0/0" },
    @{ IpProtocol="tcp"; PortRange="3389/3389"; SourceCidrIp="0.0.0.0/0" },
    @{ IpProtocol="tcp"; PortRange="3000/3000"; SourceCidrIp="0.0.0.0/0" },
    @{ IpProtocol="tcp"; PortRange="5173/5173"; SourceCidrIp="0.0.0.0/0" },
    @{ IpProtocol="tcp"; PortRange="9090/9090"; SourceCidrIp="0.0.0.0/0" },
    @{ IpProtocol="tcp"; PortRange="5432/5432"; SourceCidrIp="8.136.144.248/32" }
)

foreach ($rule in $dangerousRules) {
    Write-Host "  删除危险规则: $($rule.PortRange) from $($rule.SourceCidrIp)"
    aliyun ecs RevokeSecurityGroup `
        --RegionId cn-beijing `
        --SecurityGroupId sg-2ze2n88fyedc7ryofiq2 `
        --IpProtocol $rule.IpProtocol `
        --PortRange $rule.PortRange `
        --SourceCidrIp $rule.SourceCidrIp 2>$null
}

# 1.2 添加最小权限规则
$minRules2C2G = @(
    # 数据库只允许 8C16G 内网访问
    @{ IpProtocol="tcp"; PortRange="5432/5432"; SourceCidrIp="172.24.146.166/32"; Desc="PostgreSQL from 8C16G" },
    @{ IpProtocol="tcp"; PortRange="6379/6379"; SourceCidrIp="172.24.146.166/32"; Desc="Redis from 8C16G" },
    # SSH 只允许你的 IP
    @{ IpProtocol="tcp"; PortRange="22/22"; SourceCidrIp="$MyPublicIP/32"; Desc="SSH from my IP" },
    # ICMP 用于诊断（可选，可注释掉）
    @{ IpProtocol="icmp"; PortRange="-1/-1"; SourceCidrIp="$MyPublicIP/32"; Desc="ICMP from my IP" }
)

foreach ($rule in $minRules2C2G) {
    Write-Host "  添加规则: $($rule.Desc) ($($rule.PortRange) from $($rule.SourceCidrIp))"
    aliyun ecs AuthorizeSecurityGroup `
        --RegionId cn-beijing `
        --SecurityGroupId sg-2ze2n88fyedc7ryofiq2 `
        --IpProtocol $rule.IpProtocol `
        --PortRange $rule.PortRange `
        --SourceCidrIp $rule.SourceCidrIp `
        --Policy Accept 2>$null
}

# ==========================================
# 2. 加固 8C16G 业务层 (i-2zeh5wpy5kxcksbuku5i)
# ==========================================
Write-Host ""
Write-Host "--- 加固 8C16G 业务层安全组 (sg-2ze340kabv3u05au7c2w) ---" -ForegroundColor Green

# 2.1 删除危险规则
$dangerousRules8C = @(
    @{ IpProtocol="tcp"; PortRange="22/22"; SourceCidrIp="0.0.0.0/0" },
    @{ IpProtocol="tcp"; PortRange="3389/3389"; SourceCidrIp="0.0.0.0/0" }
)

foreach ($rule in $dangerousRules8C) {
    Write-Host "  删除危险规则: $($rule.PortRange) from $($rule.SourceCidrIp)"
    aliyun ecs RevokeSecurityGroup `
        --RegionId cn-beijing `
        --SecurityGroupId sg-2ze340kabv3u05au7c2w `
        --IpProtocol $rule.IpProtocol `
        --PortRange $rule.PortRange `
        --SourceCidrIp $rule.SourceCidrIp 2>$null
}

# 2.2 添加最小权限规则
$minRules8C = @(
    # HTTP/HTTPS 对外（面试官访问）
    @{ IpProtocol="tcp"; PortRange="80/80"; SourceCidrIp="0.0.0.0/0"; Desc="HTTP public" },
    @{ IpProtocol="tcp"; PortRange="443/443"; SourceCidrIp="0.0.0.0/0"; Desc="HTTPS public" },
    # SSH 只允许你的 IP
    @{ IpProtocol="tcp"; PortRange="22/22"; SourceCidrIp="$MyPublicIP/32"; Desc="SSH from my IP" },
    # 监控面板只允许你的 IP（如果跑 monitoring profile）
    @{ IpProtocol="tcp"; PortRange="9090/9090"; SourceCidrIp="$MyPublicIP/32"; Desc="Prometheus from my IP" },
    @{ IpProtocol="tcp"; PortRange="3002/3002"; SourceCidrIp="$MyPublicIP/32"; Desc="Grafana from my IP" }
)

foreach ($rule in $minRules8C) {
    Write-Host "  添加规则: $($rule.Desc) ($($rule.PortRange) from $($rule.SourceCidrIp))"
    aliyun ecs AuthorizeSecurityGroup `
        --RegionId cn-beijing `
        --SecurityGroupId sg-2ze340kabv3u05au7c2w `
        --IpProtocol $rule.IpProtocol `
        --PortRange $rule.PortRange `
        --SourceCidrIp $rule.SourceCidrIp `
        --Policy Accept 2>$null
}

Write-Host ""
Write-Host "=== 加固完成 ===" -ForegroundColor Cyan
Write-Host "请登录阿里云控制台验证安全组规则: https://ecs.console.aliyun.com/" -ForegroundColor Yellow
