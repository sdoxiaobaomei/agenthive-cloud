# Kubernetes 本地集群搭建完全指南

> **目标**: 从零开始搭建本地 K8s 集群用于练习  
> **适用场景**: 本地开发、K8s 技能练习、面试准备  
> **难度**: ⭐ 初学者友好

---

## 📋 方案对比

| 方案 | 复杂度 | 资源需求 | 适用平台 | 生产相似度 |
|------|--------|---------|---------|-----------|
| **Docker Desktop K8s** | ⭐ 简单 | 4GB+ 内存 | Win/Mac | ⭐⭐⭐ |
| **Kind (K8s in Docker)** | ⭐⭐ 中等 | 4GB+ 内存 | 全平台 | ⭐⭐⭐ |
| **Minikube** | ⭐⭐ 中等 | 4GB+ 内存 | 全平台 | ⭐⭐ |
| **Kubeadm 虚拟机** | ⭐⭐⭐ 复杂 | 8GB+ 内存 | Linux | ⭐⭐⭐⭐⭐ |

**推荐**: 
- Windows/Mac: Docker Desktop K8s
- Linux: Kind 或 Kubeadm
- 最像生产: Kubeadm 多节点集群

---

# 方案一: Docker Desktop Kubernetes (推荐 Win/Mac)

## 步骤 1: 安装 Docker Desktop

### Windows

```powershell
# 方法 1: 官网下载
# https://www.docker.com/products/docker-desktop

# 方法 2: Winget
winget install Docker.DockerDesktop

# 安装完成后重启电脑
```

**系统要求**:
- Windows 10/11 专业版/企业版（启用 WSL2 或 Hyper-V）
- 4GB+ 内存
- BIOS 启用虚拟化

### macOS

```bash
# 方法 1: 官网下载
# https://www.docker.com/products/docker-desktop

# 方法 2: Homebrew
brew install --cask docker

# 启动 Docker Desktop
open /Applications/Docker.app
```

**系统要求**:
- macOS 11+ (Big Sur)
- Apple Silicon 或 Intel CPU
- 4GB+ 内存

## 步骤 2: 启用 Kubernetes

### 图形界面操作

```
Docker Desktop → Settings（齿轮图标）→ Kubernetes

☑️ Enable Kubernetes
☑️ Deploy Docker Stacks to Kubernetes by default

点击: Apply & Restart
```

等待 Kubernetes 启动（约 2-5 分钟），左下角会显示:
```
🟢 Kubernetes running
```

### 验证安装

```bash
# 检查 kubectl
kubectl version --client
# Client Version: v1.29.0

# 检查集群连接
kubectl cluster-info
# Kubernetes control plane is running at https://kubernetes.docker.internal:6443

# 检查节点
kubectl get nodes
# NAME             STATUS   ROLES           AGE   VERSION
# docker-desktop   Ready    control-plane   1m    v1.29.0

# 查看所有系统 Pod
kubectl get pods -n kube-system
```

## 步骤 3: 安装常用工具

### Windows (PowerShell)

```powershell
# 安装 k9s (终端 UI)
winget install k9s

# 安装 Lens (图形界面)
winget install Mirantis.Lens

# 安装 Helm
winget install Helm.Helm
```

### macOS

```bash
# 安装 k9s
brew install k9s

# 安装 Lens
brew install --cask lens

# 安装 Helm
brew install helm
```

### 验证工具

```bash
# k9s - 交互式终端 UI
k9s

# Helm 版本
helm version
```

---

# 方案二: Kind (推荐 Linux，跨平台)

Kind (Kubernetes IN Docker) - 在 Docker 容器中运行 K8s 节点，最轻量。

## 步骤 1: 安装依赖

### Ubuntu/Debian

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 验证 Docker
docker version
```

### CentOS/RHEL/Fedora

```bash
# 安装 Docker
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

## 步骤 2: 安装 Kind

```bash
# 安装 Kind
[ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# 验证
kind version
# kind v0.20.0 go1.20.4 linux/amd64
```

## 步骤 3: 安装 kubectl

```bash
curl -LO "https://dl.k8s/release/$(curl -L -s https://dl.k8s/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

kubectl version --client
```

## 步骤 4: 创建集群

### 单节点集群（最简单）

```bash
# 创建默认单节点集群
kind create cluster --name agenthive

# 验证
kubectl cluster-info
kubectl get nodes
```

### 多节点集群（更像生产）

```bash
# 创建配置文件
cat > kind-cluster.yaml << 'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: agenthive
nodes:
  - role: control-plane
    extraPortMappings:
      # 将主机的 80 端口映射到集群
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      # 将主机的 443 端口映射到集群
      - containerPort: 443
        hostPort: 443
        protocol: TCP
      # API 端口
      - containerPort: 3001
        hostPort: 3001
        protocol: TCP
  - role: worker
  - role: worker
EOF

# 创建多节点集群
kind create cluster --config kind-cluster.yaml

# 验证
kubectl get nodes
# NAME                       STATUS   ROLES           AGE   VERSION
# agenthive-control-plane    Ready    control-plane   1m    v1.28.0
# agenthive-worker           Ready    <none>          1m    v1.28.0
# agenthive-worker2          Ready    <none>          1m    v1.28.0
```

## 步骤 5: 安装 Ingress Controller

```bash
# 安装 Nginx Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# 等待就绪
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

## 步骤 6: 管理集群

```bash
# 查看集群列表
kind get clusters

# 切换上下文
kubectl config use-context kind-agenthive

# 删除集群
kind delete cluster --name agenthive

# 导出集群配置
kind export kubeconfig --name agenthive
```

---

# 方案三: Kubeadm 虚拟机集群（最接近生产）

使用 Vagrant + VirtualBox 创建多虚拟机 K8s 集群。

## 步骤 1: 安装依赖

### 安装 VirtualBox + Vagrant

```bash
# Ubuntu/Debian
sudo apt install -y virtualbox vagrant

# macOS
brew install --cask virtualbox
brew install --cask vagrant

# Windows
winget install Oracle.VirtualBox
winget install Hashicorp.Vagrant
```

## 步骤 2: 创建 Vagrantfile

```bash
mkdir ~/k8s-cluster && cd ~/k8s-cluster
cat > Vagrantfile << 'EOF'
# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  # 使用 Ubuntu 22.04
  config.vm.box = "ubuntu/jammy64"

  # 主节点
  config.vm.define "master" do |master|
    master.vm.hostname = "master"
    master.vm.network "private_network", ip: "192.168.56.10"
    master.vm.network "forwarded_port", guest: 6443, host: 6443
    master.vm.provider "virtualbox" do |vb|
      vb.memory = "2048"
      vb.cpus = 2
    end
    master.vm.provision "shell", inline: <<-SHELL
      # 安装容器运行时和 K8s
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker vagrant
      
      # 安装 kubeadm, kubelet, kubectl
      sudo apt-get update
      sudo apt-get install -y apt-transport-https ca-certificates curl gpg
      curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
      echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
      sudo apt-get update
      sudo apt-get install -y kubelet kubeadm kubectl
      sudo apt-mark hold kubelet kubeadm kubectl
      
      # 初始化集群
      sudo kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=192.168.56.10
      
      # 配置 kubectl
      mkdir -p $HOME/.kube
      sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
      sudo chown $(id -u):$(id -g) $HOME/.kube/config
      
      # 安装 Flannel 网络插件
      kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
      
      # 生成 join 命令
      kubeadm token create --print-join-command > /vagrant/join-command.sh
    SHELL
  end

  # 工作节点 1
  config.vm.define "worker1" do |worker|
    worker.vm.hostname = "worker1"
    worker.vm.network "private_network", ip: "192.168.56.11"
    worker.vm.provider "virtualbox" do |vb|
      vb.memory = "2048"
      vb.cpus = 2
    end
    worker.vm.provision "shell", inline: <<-SHELL
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker vagrant
      
      sudo apt-get update
      sudo apt-get install -y apt-transport-https ca-certificates curl gpg
      curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
      echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
      sudo apt-get update
      sudo apt-get install -y kubelet kubeadm kubectl
      sudo apt-mark hold kubelet kubeadm kubectl
      
      # 等待 master 初始化完成
      sleep 60
      # 加入集群
      sudo bash /vagrant/join-command.sh
    SHELL
  end

  # 工作节点 2
  config.vm.define "worker2" do |worker|
    worker.vm.hostname = "worker2"
    worker.vm.network "private_network", ip: "192.168.56.12"
    worker.vm.provider "virtualbox" do |vb|
      vb.memory = "2048"
      vb.cpus = 2
    end
    worker.vm.provision "shell", inline: <<-SHELL
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker vagrant
      
      sudo apt-get update
      sudo apt-get install -y apt-transport-https ca-certificates curl gpg
      curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
      echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
      sudo apt-get update
      sudo apt-get install -y kubelet kubeadm kubectl
      sudo apt-mark hold kubelet kubeadm kubectl
      
      # 等待 master 初始化完成
      sleep 90
      # 加入集群
      sudo bash /vagrant/join-command.sh
    SHELL
  end
end
EOF
```

## 步骤 3: 启动集群

```bash
# 启动所有虚拟机（需要 15-20 分钟）
vagrant up

# 单独启动
vagrant up master
vagrant up worker1
vagrant up worker2
```

## 步骤 4: 配置本地 kubectl

```bash
# 从 master 复制 kubeconfig
mkdir -p ~/.kube
vagrant ssh master -c "cat ~/.kube/config" > ~/.kube/config-vagrant

# 修改 server 地址为本地可访问
sed -i 's/192.168.56.10:6443/127.0.0.1:6443/g' ~/.kube/config-vagrant

# 使用新配置
export KUBECONFIG=~/.kube/config-vagrant

# 验证
kubectl get nodes
```

## 步骤 5: 管理集群

```bash
# SSH 进入节点
vagrant ssh master
vagrant ssh worker1

# 停止集群
vagrant halt

# 销毁集群
vagrant destroy -f

# 重新加载配置
vagrant reload
```

---

# 部署 AgentHive 到集群

无论你选择哪种方案，部署 AgentHive 的步骤相同：

```bash
# 1. 确保 kubectl 连接正确
kubectl cluster-info

# 2. 构建镜像
./scripts/build-local-k8s.sh

# 3. 部署（根据集群类型选择）

# Docker Desktop / Kind
kubectl apply -k k8s/local/

# Kubeadm（需要修改镜像地址）
# 先复制镜像到每个节点，或使用镜像仓库

# 4. 验证
kubectl get pods -n agenthive -w

# 5. 访问
# Docker Desktop: http://localhost
# Kind: http://localhost
# Kubeadm: http://192.168.56.10
```

---

# 集群管理技巧

## 常用 kubectl 命令

```bash
# 查看资源
kubectl get nodes                    # 节点
kubectl get pods -A                  # 所有 Pod
kubectl get pods -n kube-system      # 系统 Pod
kubectl get svc -A                   # 所有服务
kubectl get all -n agenthive         # 某命名空间所有资源

# 查看详情
kubectl describe node <node-name>
kubectl describe pod <pod-name> -n agenthive
kubectl logs -f <pod-name> -n agenthive
kubectl exec -it <pod-name> -n agenthive -- sh

# 端口转发
kubectl port-forward svc/api 3001:3001 -n agenthive
```

## 使用 k9s 图形化管理

```bash
# 启动 k9s
k9s

# 快捷键:
# :  - 切换命名空间
# /  - 搜索
# d  - 查看描述
# l  - 查看日志
# s  - 进入 shell
# r  - 重启
# shift+f - 端口转发
# q  - 退出
```

---

# 常见问题

## Q1: Docker Desktop K8s 启动失败

```bash
# 重置 Kubernetes
Docker Desktop → Troubleshoot → Reset Kubernetes Cluster

# 如果还不行，重置整个 Docker Desktop
Docker Desktop → Troubleshoot → Clean / Purge data
```

## Q2: Kind 创建集群超时

```bash
# 检查 Docker 是否运行
docker info

# 删除失败的集群
kind delete cluster --name agenthive

# 重新创建（增加超时时间）
kind create cluster --name agenthive --wait 5m
```

## Q3: Vagrant 虚拟机启动失败

```bash
# 检查 VirtualBox 是否安装
vboxmanage --version

# 查看 Vagrant 日志
vagrant up --debug

# 销毁重建
vagrant destroy -f
vagrant up
```

## Q4: 无法拉取镜像

```bash
# 配置镜像加速器（阿里云）
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://<your-id>.mirror.aliyuncs.com"
  ]
}
EOF

sudo systemctl restart docker
```

---

# 学习路径建议

## Week 1: 基础操作
- [ ] 创建/删除 Pod
- [ ] 使用 Deployment 管理应用
- [ ] Service 和 DNS 解析
- [ ] ConfigMap 和 Secret

## Week 2: 存储和网络
- [ ] PersistentVolume 和 PVC
- [ ] Ingress 配置
- [ ] NetworkPolicy

## Week 3: 高级特性
- [ ] Helm 包管理
- [ ] HPA 自动扩缩容
- [ ] RBAC 权限控制

## Week 4: 实战项目
- [ ] 完整部署 AgentHive
- [ ] 配置监控（Prometheus + Grafana）
- [ ] CI/CD 集成

---

# 下一步

选择你的集群方案:

1. **简单快速** → Docker Desktop K8s
2. **轻量多节点** → Kind
3. **最像生产** → Kubeadm

配置完成后，继续阅读:
- [本地 K8s 部署指南](./LOCAL-K8S-DOCKER-DESKTOP.md) - 部署 AgentHive
- [K8s 官方教程](https://kubernetes.io/docs/tutorials/)
