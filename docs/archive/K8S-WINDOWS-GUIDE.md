# Windows 用户 Kubernetes 特别指南

> 针对 Windows 环境的补充说明和常见问题

---

## 🪟 Windows 版本要求

| 版本 | 支持情况 | 说明 |
|------|---------|------|
| Windows 11 家庭版/专业版 | ✅ 完美支持 | 推荐 |
| Windows 10 专业版/企业版 (1903+) | ✅ 完美支持 | 需要 WSL2 |
| Windows 10 家庭版 | ⚠️ 有限支持 | 需要额外配置 |
| Windows 8/7 | ❌ 不支持 | 请升级系统 |

---

## 🚀 推荐方案: Docker Desktop + WSL2

### 安装步骤

#### 1. 启用 WSL2

```powershell
# 以管理员身份运行 PowerShell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# 重启电脑
Restart-Computer

# 设置 WSL2 为默认版本
wsl --set-default-version 2
```

#### 2. 安装 Ubuntu

```powershell
# 从 Microsoft Store 安装 Ubuntu 22.04 LTS
# 或命令行安装:
wsl --install -d Ubuntu-22.04

# 设置 Ubuntu 为默认
wsl --set-default Ubuntu-22.04
```

#### 3. 安装 Docker Desktop

```powershell
# 使用 Winget
winget install Docker.DockerDesktop

# 或使用 Chocolatey
choco install docker-desktop
```

**安装后配置**:
1. Docker Desktop → Settings → General
2. ✅ Use the WSL 2 based engine
3. Resources → WSL Integration
4. ✅ Enable integration with my default WSL distro
5. ✅ 勾选 Ubuntu-22.04

#### 4. 启用 Kubernetes

```powershell
# 图形界面操作
# Docker Desktop → Settings → Kubernetes
# ☑️ Enable Kubernetes
# Apply & Restart

# 或使用 PowerShell 自动启用（实验性）
# 需要安装 Docker CLI
```

---

## 🐧 WSL2 + Kind 方案（推荐进阶用户）

在 WSL2 中使用 Kind 创建更轻量的集群。

### WSL2 Ubuntu 配置

```bash
# 进入 WSL2
wsl

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl git vim

# Docker 已经在 WSL2 中可用（通过 Docker Desktop 集成）
docker version

# 安装 kubectl
curl -LO "https://dl.k8s/release/$(curl -L -s https://dl.k8s/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# 安装 Kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/

# 验证
kind version
kubectl version --client
```

### 创建 Kind 集群

```bash
# 创建配置文件
cat > kind-cluster.yaml << 'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: agenthive
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 3001
        hostPort: 3001
        protocol: TCP
  - role: worker
  - role: worker
EOF

# 创建集群
kind create cluster --config kind-cluster.yaml

# 验证
kubectl get nodes
```

### Windows 访问 WSL2 中的集群

```powershell
# 在 Windows PowerShell 中复制 kubeconfig
wsl -d Ubuntu-22.04 -e cat ~/.kube/config > $env:USERPROFILE\.kube\config-kind

# 设置环境变量
$env:KUBECONFIG = "$env:USERPROFILE\.kube\config-kind"

# 验证
kubectl get nodes
```

---

## 🔧 常见问题

### 1. Docker Desktop Kubernetes 无法启动

**症状**: Kubernetes 一直显示 `Starting...`

**解决步骤**:
```powershell
# 1. 检查 WSL2 状态
wsl --list --verbose

# 2. 如果 docker-desktop 状态异常，注销后重新注册
wsl --unregister docker-desktop
wsl --unregister docker-desktop-data

# 3. 重启 Docker Desktop

# 4. 如果还不行，完全重置
Docker Desktop → Troubleshoot → Clean / Purge data
```

### 2. 端口冲突

**症状**: `listen tcp :80: bind: address already in use`

**解决**:
```powershell
# 查找占用 80 端口的进程
netstat -ano | findstr :80

# 或使用 PowerShell
Get-NetTCPConnection -LocalPort 80

# 停止占用端口的服务（如 IIS、Apache、Nginx）
Stop-Service -Name "W3SVC"  # IIS
# 或在服务管理器中停止
```

### 3. 镜像拉取慢/失败

**症状**: `ImagePullBackOff` 或超时

**解决**:
```powershell
# Docker Desktop 设置镜像加速器
# Settings → Docker Engine → 编辑配置

# 添加阿里云镜像加速器
{
  "registry-mirrors": [
    "https://<your-id>.mirror.aliyuncs.com"
  ]
}
```

### 4. WSL2 内存不足

**症状**: Pod 被 OOMKilled

**解决**:
```powershell
# 创建/编辑 .wslconfig
cat > $env:USERPROFILE\.wslconfig << 'EOF'
[wsl2]
memory=6GB
processors=4
swap=2GB
EOF

# 重启 WSL
wsl --shutdown
wsl
```

### 5. kubectl 无法连接集群

**症状**: `The connection to the server localhost:8080 was refused`

**解决**:
```powershell
# 检查 kubeconfig
$env:KUBECONFIG

# 使用 Docker Desktop 的 kubeconfig
$env:KUBECONFIG = "$env:USERPROFILE\.kube\config"

# 或重新生成
kubectl config view
```

---

## 🛠️ Windows 推荐工具

### 终端

```powershell
# Windows Terminal (强烈推荐)
winget install Microsoft.WindowsTerminal

# 或 PowerShell 7
winget install Microsoft.PowerShell
```

### K8s 管理工具

```powershell
# k9s - 终端 UI
winget install k9s

# Lens - 图形界面
winget install Mirantis.Lens

# Helm
winget install Helm.Helm

# k3d - 另一个轻量级 K8s（可选）
winget install k3d
```

### IDE 插件

- **VS Code**: 
  - Kubernetes 插件 (ms-kubernetes-tools.vscode-kubernetes-tools)
  - YAML 插件 (redhat.vscode-yaml)
  
- **IntelliJ IDEA**: 
  - Kubernetes 插件

---

## 📝 PowerShell 常用命令

```powershell
# 查看 K8s 资源
kubectl get pods -n agenthive
kubectl get svc -n agenthive

# 端口转发
kubectl port-forward svc/api 3001:3001 -n agenthive

# 查看日志
kubectl logs -f deployment/api -n agenthive

# 进入容器
kubectl exec -it deployment/api -n agenthive -- sh

# 使用 k9s
k9s -n agenthive
```

---

## 🎯 快速检查清单

安装完成后验证:

```powershell
# 1. WSL2 状态
wsl --list --verbose
# 应看到: Ubuntu-22.04 Running 2

# 2. Docker 状态
docker version
# Client/Server 都正常

# 3. Kubernetes 状态
kubectl cluster-info
# Kubernetes control plane is running

# 4. 节点状态
kubectl get nodes
# STATUS 应为 Ready

# 5. 部署测试
kubectl run test --image=nginx --port=80
kubectl get pods
kubectl delete pod test
```

全部通过后即可开始部署 AgentHive!

---

## 🔗 参考链接

- [Docker Desktop WSL2 后端](https://docs.docker.com/desktop/windows/wsl/)
- [WSL 官方文档](https://docs.microsoft.com/zh-cn/windows/wsl/)
- [Windows Kubectl 安装](https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/)
