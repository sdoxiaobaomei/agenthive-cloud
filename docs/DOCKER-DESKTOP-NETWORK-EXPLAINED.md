# Docker Desktop 网络架构详解

> 解释为什么本机能访问到 Docker Desktop 里的容器

---

## 🤔 问题的本质

**用户观察到的现象**:
```
Windows/Mac 本机
  ├── 浏览器访问 http://localhost ✓ 成功
  │
  └── Docker Desktop VM (Linux)
        ├── Container: landing (端口 80)
        ├── Container: api (端口 3001)
        ├── Container: postgres (端口 5432)
        └── Container: redis (端口 6379)

疑问: "我本机和容器不在同一个网络，为什么能访问到？"
```

**答案**: **端口映射（Port Mapping）+ Docker Desktop 特殊的网络桥接**

---

## 🏗️ Docker Desktop 网络架构

### 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Windows / macOS 主机                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Docker Desktop VM                               │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Docker Daemon                                │  │   │
│  │  │                                                                  │  │   │
│  │  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐         │  │   │
│  │  │   │   Container │   │   Container │   │   Container │         │  │   │
│  │  │   │   Landing   │   │     API     │   │  Postgres   │         │  │   │
│  │  │   │   :80       │   │   :3001     │   │   :5432     │         │  │   │
│  │  │   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘         │  │   │
│  │  │          │                 │                 │                 │  │   │
│  │  │          └─────────────────┴─────────────────┘                 │  │   │
│  │  │                            │                                   │  │   │
│  │  │                    Docker Network                              │  │   │
│  │  │                  (bridge/vxlan)                                │  │   │
│  │  │                            │                                   │  │   │
│  │  │                            ▼                                   │  │   │
│  │  │   ┌────────────────────────────────────────────────────────┐  │  │   │
│  │  │   │  VM Network Interface (eth0)                           │  │  │   │
│  │  │   │  IP: 192.168.65.x (内部)                               │  │  │   │
│  │  │   └────────────────────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │   ┌──────────────────────────────────────────────────────────────┐   │   │
│  │   │  Port Forwarding Layer (由 Docker Desktop 管理)              │   │   │
│  │   │                                                              │   │   │
│  │   │  主机:80 ──────► VM:80 ──────► Container:80                │   │   │
│  │   │  主机:3001 ────► VM:3001 ────► Container:3001              │   │   │
│  │   │  主机:5432 ────► VM:5432 ────► Container:5432              │   │   │
│  │   │  主机:6379 ────► VM:6379 ─────► Container:6379             │   │   │
│  │   └──────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  主机网络接口:                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  localhost / 127.0.0.1                                               │   │
│  │  或 192.168.x.x (局域网 IP)                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 数据流详解

### 场景 1: 浏览器访问 http://localhost

```
1. 浏览器请求: http://localhost:80
   │
   ▼
2. Windows/macOS 网络层
   │  发现是 localhost，检查本机端口 80
   │
   ▼
3. Docker Desktop 端口转发层
   │  "啊，端口 80 被映射到 VM 了！"
   │  将请求转发到 VM 的端口 80
   │
   ▼
4. VM 内部 (Linux)
   │  接收端口 80 的请求
   │  根据 Docker 的端口映射规则
   │  "端口 80 → Container landing:80"
   │
   ▼
5. Container (landing)
   │  Nginx 接收请求
   │  返回网页内容
   │
   ▼ (原路返回)
6. 浏览器显示页面 ✓
```

### 场景 2: 代码连接 postgres://localhost:5432

```
1. 应用代码连接: localhost:5432
   │
   ▼
2. 本机网络层
   │
   ▼
3. Docker Desktop 端口转发
   │  5432 → VM:5432
   │
   ▼
4. VM 内部
   │  5432 → Container postgres:5432
   │
   ▼
5. Container (postgres)
   │  PostgreSQL 接收连接
   │
   ▼
6. 连接成功 ✓
```

---

## ⚙️ 端口映射是如何配置的？

### 方式 1: docker run -p 参数

```bash
# 最常用的方式
docker run -p 主机端口:容器端口 镜像名

# 示例
docker run -p 80:80 nginx        # 主机 80 → 容器 80
docker run -p 3001:3001 my-api   # 主机 3001 → 容器 3001
docker run -p 5432:5432 postgres # 主机 5432 → 容器 5432

# 可以映射到不同端口
docker run -p 8080:80 nginx      # 主机 8080 → 容器 80
```

### 方式 2: Docker Compose 中的 ports

```yaml
# docker-compose.yml
services:
  landing:
    image: agenthive/landing
    ports:
      - "80:80"      # 主机:容器
    
  api:
    image: agenthive/api
    ports:
      - "3001:3001"
  
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

**启动时会显示**:
```bash
docker-compose up
# 输出:
# Container landing  Creating
# Container landing  Created
# Container landing  Starting
# Container landing  Started
# 0.0.0.0:80->80/tcp     # ← 端口映射已建立！
```

### 方式 3: 查看现有映射

```bash
# 查看容器的端口映射
docker ps
# CONTAINER ID   IMAGE      COMMAND   PORTS
# abc123         landing    "nginx"   0.0.0.0:80->80/tcp
# def456         api        "node"    0.0.0.0:3001->3001/tcp
# ghj789         postgres   "postgres" 0.0.0.0:5432->5432/tcp

# 详细查看
docker port <容器名>
docker inspect <容器名> | grep -A 20 "NetworkSettings"
```

---

## 🌐 Docker Desktop 的特殊机制

### 为什么普通 Docker 和 Docker Desktop 表现不同？

```yaml
Linux 原生 Docker:
  主机: Linux 机器
  容器: 直接跑在主机内核上
  网络: 容器和主机共享内核网络栈
  访问: 主机可以直接访问容器 IP（172.17.0.x）

Docker Desktop (Windows/Mac):
  主机: Windows/Mac
  VM: Linux 虚拟机（Docker Desktop 内部）
  容器: 跑在 VM 里的 Docker 中
  网络: 容器在 VM 内部网络里
  访问: 必须通过端口映射！
```

**关键区别**:

| 特性 | Linux Docker | Docker Desktop (Win/Mac) |
|------|-------------|-------------------------|
| 容器位置 | 主机内核 | VM 中的 Docker |
| 容器 IP 可访问 | ✅ 直接访问 | ❌ 无法直接访问 |
| 必须使用端口映射 | 推荐，但可选 | **必须** |
| 网络层级 | 单层 | 多层（主机→VM→容器）|

---

## 🔍 验证实验

### 实验 1: 查看端口映射

```bash
# 1. 启动一个带端口映射的容器
docker run -d -p 8888:80 --name test-nginx nginx

# 2. 查看端口映射
docker port test-nginx
# 80/tcp -> 0.0.0.0:8888

# 3. 本机访问
curl http://localhost:8888
# <!DOCTYPE html>
# <html>...Nginx 页面...</html>

# 4. 清理
docker stop test-nginx
docker rm test-nginx
```

### 实验 2: 不映射端口会怎样？

```bash
# 1. 启动不带端口映射的容器
docker run -d --name test-internal nginx

# 2. 查看端口（没有映射）
docker port test-internal
# （无输出）

# 3. 本机访问（失败）
curl http://localhost:80
# curl: (7) Failed to connect to localhost port 80

# 4. 只能通过 Docker 网络访问
docker exec test-internal curl http://localhost:80
# 成功！但这是在容器内部执行的

# 5. 清理
docker stop test-internal
docker rm test-internal
```

### 实验 3: Windows 上验证网络层级

```powershell
# 1. 查看本机端口占用（PowerShell）
netstat -ano | findstr :80
# TCP    0.0.0.0:80    0.0.0.0:0    LISTENING    12345
# ↑ 这是 Docker Desktop 的端口转发进程

# 2. 在 WSL2 中查看
wsl -d docker-desktop
netstat -tlnp | grep :80
# tcp  0.0.0.0:80  0.0.0.0:*  LISTEN  - (docker-proxy)

# 3. 退出 WSL2
exit
```

---

## 📋 实际项目中的应用

### 你的 4 个项目容器

```yaml
# 假设你的 docker-compose.yml 是这样
version: '3.8'
services:
  landing:
    image: agenthive/landing
    ports:
      - "80:80"          # ← 映射！本机 80 → 容器 80
  
  api:
    image: agenthive/api
    ports:
      - "3001:3001"      # ← 映射！本机 3001 → 容器 3001
  
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"      # ← 映射！本机 5432 → 容器 5432
    environment:
      POSTGRES_PASSWORD: dev
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"      # ← 映射！本机 6379 → 容器 6379
```

### 访问方式

| 服务 | 容器内部 | 本机访问 | 说明 |
|------|---------|---------|------|
| landing | http://landing:80 | http://localhost | 通过端口映射 |
| api | http://api:3001 | http://localhost:3001 | 通过端口映射 |
| postgres | postgres:5432 | localhost:5432 | 通过端口映射 |
| redis | redis:6379 | localhost:6379 | 通过端口映射 |

### 容器间通信（不需要端口映射）

```yaml
# 在 docker-compose 中，容器可以通过服务名互相访问
services:
  api:
    environment:
      # 这是正确的！在同一网络内
      DB_HOST: postgres      # ← 直接通过服务名访问
      REDIS_URL: redis:6379  # ← 直接通过服务名访问
      
  landing:
    environment:
      # 这也是正确的！
      API_URL: http://api:3001  # ← 容器间直接通信
```

**容器间 vs 本机访问**:
```
场景 1: 本机访问容器
  本机浏览器 → localhost:3001 → Docker Desktop → VM → API 容器
  （必须通过端口映射）

场景 2: 容器 A 访问容器 B
  API 容器 → http://postgres:5432 → PostgreSQL 容器
  （同一 Docker 网络内，直接通信，不需要端口映射）
```

---

## ⚠️ 常见问题和注意事项

### 1. 端口冲突

```bash
# 错误：端口已被占用
docker run -p 80:80 nginx
# Error response from daemon: 
# driver failed programming external connectivity: 
# Bind for 0.0.0.0:80 failed: port is already allocated

# 解决：换个端口
docker run -p 8080:80 nginx
```

### 2. 只绑定到 localhost

```bash
# 默认绑定到 0.0.0.0（所有接口）
-p 80:80        # 同局域网其他机器也能访问

# 只绑定到 localhost（更安全）
-p 127.0.0.1:80:80  # 只有本机能访问
```

### 3. Windows 防火墙

```powershell
# 如果访问不了，检查防火墙
# Settings → Windows Security → Firewall → 允许 Docker Desktop
```

### 4. 动态端口分配

```bash
# 让 Docker 随机分配主机端口
-p 80     # 主机随机端口 → 容器 80

# 查看分配的端口
docker port <容器名>
# 80/tcp -> 0.0.0.0:49153
```

---

## 🎯 总结

| 问题 | 答案 |
|------|------|
| 本机应该访问不到容器吗？ | 没有端口映射的话，是的 |
| 为什么现在能访问到？ | 因为配置了 **端口映射** (`-p` 参数) |
| Docker Desktop 如何做到的？ | 内置了 **端口转发层**：主机端口 → VM 端口 → 容器端口 |
| 容器之间如何通信？ | 通过 **Docker 网络**，直接用服务名，不需要端口映射 |

**记忆口诀**:
> 本机访问容器：**端口映射是钥匙** (`-p 主机:容器`)
> 容器互相访问：**服务名直接连** (同一网络内)

---

## 🔗 延伸阅读

- [Docker 网络文档](https://docs.docker.com/network/)
- [Docker Desktop 网络](https://docs.docker.com/desktop/networking/)
- [Port Mapping 详解](https://docs.docker.com/config/containers/container-networking/)
