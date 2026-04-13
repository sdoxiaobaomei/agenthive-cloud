# 在 Linux VM 中安装 Docker

本文档介绍如何在常见的 Linux 发行版（Ubuntu / Debian / CentOS / RHEL）的虚拟机中安装 Docker Engine。

---

## 目录

1. [环境要求](#环境要求)
2. [卸载旧版本](#卸载旧版本)
3. [Ubuntu / Debian 安装步骤](#ubuntu--debian-安装步骤)
4. [CentOS / RHEL / Fedora 安装步骤](#centos--rhel--fedora-安装步骤)
5. [验证安装](#验证安装)
6. [非 Root 用户运行 Docker](#非-root-用户运行-docker)
7. [配置 Docker 开机自启](#配置-docker-开机自启)
8. [常见问题](#常见问题)

---

## 环境要求

- 64 位 Linux 发行版
- 内核版本 >= 3.10（建议 >= 4.x）
- 能够连接互联网
- `sudo` 权限

检查内核版本：

```bash
uname -r
```

---

## 卸载旧版本

如果系统之前安装过旧版本的 Docker，建议先卸载：

```bash
sudo apt-get remove docker docker-engine docker.io containerd runc
# 或 CentOS/RHEL
sudo yum remove docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine
```

---

## Ubuntu / Debian 安装步骤

### 1. 更新 apt 包索引并安装依赖

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
```

### 2. 添加 Docker 官方 GPG 密钥

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

> **Debian 用户注意**：将上面 URL 中的 `ubuntu` 替换为 `debian`。

### 3. 设置稳定版仓库

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 4. 安装 Docker Engine

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

## CentOS / RHEL / Fedora 安装步骤

### 1. 安装 yum-utils 并添加仓库

```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
```

> **RHEL / Fedora 用户注意**：将上面 URL 中的 `centos` 替换为 `rhel` 或 `fedora`。

### 2. 安装 Docker Engine

```bash
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

## 验证安装

### 启动 Docker 服务

```bash
sudo systemctl start docker
```

### 运行测试容器

```bash
sudo docker run hello-world
```

如果看到 `Hello from Docker!` 的欢迎信息，说明安装成功。

### 查看 Docker 版本

```bash
docker --version
docker compose version
```

---

## 非 Root 用户运行 Docker

默认情况下，运行 `docker` 命令需要 `root` 权限。可以将当前用户加入 `docker` 组，免去每次使用 `sudo`：

```bash
sudo usermod -aG docker $USER
newgrp docker
```

> **注意**：加入用户组后需要重新登录（或执行 `newgrp docker`）才能生效。

验证：

```bash
docker run hello-world
```

---

## 配置 Docker 开机自启

```bash
sudo systemctl enable docker
```

常用管理命令：

```bash
sudo systemctl status docker   # 查看状态
sudo systemctl stop docker     # 停止服务
sudo systemctl restart docker  # 重启服务
```

---

## 常见问题

### Q1: `docker: Cannot connect to the Docker daemon`

- 确认 Docker 服务已启动：`sudo systemctl start docker`
- 确认当前用户已加入 `docker` 组并重新登录

### Q2: 国内网络下载慢

可以配置镜像加速器（如阿里云、DaoCloud、腾讯云等）：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://<your-mirror>.mirror.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### Q3: 防火墙或 SELinux 导致容器网络不通

- CentOS/RHEL 可临时关闭 SELinux 测试：`sudo setenforce 0`
- 检查防火墙规则是否放行了所需端口

---

## 参考链接

- [Docker 官方文档 - Install Docker Engine](https://docs.docker.com/engine/install/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
