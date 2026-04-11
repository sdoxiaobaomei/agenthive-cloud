# AgentHive ECS 部署指南（阿里云百炼版）

> **适用场景**: 单台 ECS 运行 AgentHive，使用阿里云百炼 API 作为 LLM 后端

---

## 环境要求

| 组件 | 配置 | 说明 |
|------|------|------|
| ECS | 2vCPU 2GB+ | 阿里云/腾讯云/AWS 均可 |
| OS | Ubuntu 22.04 LTS | 推荐 |
| Docker | 24.0+ | 容器运行 |
| Docker Compose | 2.20+ | 编排工具 |

---

## 1. 获取阿里云百炼 API Key

### 1.1 创建账号
1. 访问 [阿里云百炼](https://bailian.console.aliyun.com/)
2. 使用阿里云账号登录（或注册新账号）

### 1.2 创建 API Key
1. 进入「模型广场」→ 「API Key 管理」
2. 点击「创建新的 API Key」
3. 记录 Key（格式：`sk-xxxxx`）

### 1.3 开通模型服务
1. 进入「模型广场」
2. 找到以下模型并点击「开通」：
   - `qwen-turbo` (快速响应，便宜)
   - `qwen-plus` (平衡选择)
   - `qwen-max` (最强性能，较贵)

---

## 2. 服务器初始化

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
sudo apt install -y docker.io docker-compose-plugin

# 启动 Docker
sudo systemctl enable docker
sudo systemctl start docker

# 添加用户到 docker 组
sudo usermod -aG docker $USER
newgrp docker

# 验证
docker --version
docker compose version
```

---

## 3. 创建 Swap（内存<2GB时必需）

```bash
# 检查内存
free -h

# 如果内存 < 2GB，创建 2GB Swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 验证
free -h
```

---

## 4. 部署 AgentHive

### 4.1 克隆代码

```bash
cd ~
git clone https://github.com/your-org/agenthive-cloud.git
cd agenthive-cloud
```

### 4.2 配置环境变量

```bash
# 创建环境配置文件
cat > .env << 'EOF'
# ================================
# 数据库配置
# ================================
DB_PASSWORD=ChangeMeToStrongPassword123!

# ================================
# JWT 密钥
# ================================
JWT_SECRET=$(openssl rand -base64 64)

# ================================
# LLM API 配置 - 阿里云百炼
# ================================
# 必填：从阿里云百炼控制台获取
LLM_API_KEY=sk-your-actual-api-key-here

# 阿里云百炼兼容端点
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 模型选择（三选一）
# LLM_MODEL=qwen-turbo        # 快速、便宜 (~¥0.5/1M tokens)
LLM_MODEL=qwen-plus          # 平衡选择 (~¥2/1M tokens)
# LLM_MODEL=qwen-max          # 最强能力 (~¥20/1M tokens)

# ================================
# 可选：Ollama 本地模型配置
# （当 LLM_API_KEY 未设置时使用）
# ================================
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=qwen3:14b

# ================================
# 可选：其他 API 提供商
# ================================
# OpenAI
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_MODEL=gpt-3.5-turbo

# 月之暗面
# LLM_BASE_URL=https://api.moonshot.cn/v1
# LLM_MODEL=moonshot-v1-8k
EOF

# 编辑配置文件，填入你的 API Key
nano .env
```

### 4.3 启动服务

```bash
# 使用 Docker Compose 启动
docker compose up -d

# 等待服务启动
sleep 10

# 查看状态
docker compose ps
```

---

## 5. 验证部署

### 5.1 检查容器状态

```bash
# 查看所有容器
docker compose ps

# 预期输出：
# NAME                  STATUS          PORTS
# agenthive-api         Up 10 seconds   
# agenthive-agent       Up 10 seconds   
# agenthive-db          Up 10 seconds   5432/tcp
# agenthive-landing     Up 10 seconds   
# agenthive-nginx       Up 10 seconds   0.0.0.0:80->80/tcp
# agenthive-redis       Up 10 seconds   6379/tcp
```

### 5.2 检查 LLM 连接

```bash
# 查看 API 服务日志
docker compose logs api | grep -i llm

# 预期输出：
# [LLM] Using OpenAI-compatible API: https://dashscope.aliyuncs.com/compatible-mode/v1
# [LLM] Connected to openai
```

### 5.3 测试访问

```bash
# 测试 Landing
curl -s http://localhost | head -10

# 测试 API 健康检查
curl -s http://localhost/api/health

# 预期输出：
# {"status":"ok","timestamp":"2026-04-07T..."}
```

---

## 6. 配置域名（可选）

### 6.1 域名解析
在你的域名服务商处添加 A 记录：
```
agenthive.yourdomain.com → 你的ECS公网IP
```

### 6.2 配置 HTTPS

```bash
# 安装 Certbot
sudo apt install -y certbot

# 申请证书
sudo certbot certonly --standalone -d agenthive.yourdomain.com

# 证书位置
# /etc/letsencrypt/live/agenthive.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/agenthive.yourdomain.com/privkey.pem
```

### 6.3 更新 Nginx 配置

```bash
# 编辑 nginx/conf.d/default.conf
# 取消 SSL 配置注释
# 更新 server_name 为你的域名

# 重启 nginx
docker compose restart nginx
```

---

## 7. 常用命令

```bash
# 查看日志
docker compose logs -f [service-name]

# 重启服务
docker compose restart [service-name]

# 停止所有服务
docker compose down

# 完全清理（包括数据）
docker compose down -v

# 查看资源使用
docker stats

# 进入容器
docker exec -it agenthive-api sh
```

---

## 8. 故障排查

### 8.1 LLM API 连接失败

```bash
# 检查日志
docker compose logs api | grep -i error

# 常见问题：
# 1. API Key 错误 - 检查 .env 中的 LLM_API_KEY
# 2. 模型未开通 - 在阿里云百炼控制台开通模型
# 3. 网络问题 - 检查 ECS 是否能访问 dashscope.aliyuncs.com

# 测试网络连通性
curl -v https://dashscope.aliyuncs.com/compatible-mode/v1/models \
  -H "Authorization: Bearer $LLM_API_KEY"
```

### 8.2 内存不足

```bash
# 查看内存使用
free -h
docker stats --no-stream

# 如果内存不足，增加 Swap
sudo fallocate -l 4G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
```

### 8.3 数据库连接失败

```bash
# 检查数据库容器
docker compose logs postgres

# 进入数据库容器
docker exec -it agenthive-db psql -U agenthive -d agenthive
```

---

## 9. 费用预估

### 阿里云百炼费用

| 模型 | 价格 | 预估月费用 |
|------|------|------------|
| qwen-turbo | ¥0.5/1M tokens | ¥5-20 |
| qwen-plus | ¥2/1M tokens | ¥20-50 |
| qwen-max | ¥20/1M tokens | ¥100-300 |

> **建议**：先用 `qwen-plus`，不够用再升级到 `qwen-max`

### ECS 费用

| 配置 | 月费用 |
|------|--------|
| 阿里云 2vCPU 2GB | ~¥60 |
| 阿里云新人优惠 | **¥99/年** ⭐ |

---

## 10. 后续：切到本地 Ollama

当你的 4070 Ti Super 准备好后，可以切换：

### 10.1 本地启动 Ollama

```bash
# 在 4070 TiS 电脑上安装 Ollama
# Windows: https://ollama.com/download/windows

# 拉取模型（4-bit 量化版）
ollama pull qwen3:14b-q4_0

# 确认模型存在
ollama list
```

### 10.2 配置内网穿透（frp）

```bash
# 在 ECS 上安装 frps（服务端）
wget https://github.com/fatedier/frp/releases/download/v0.60.0/frp_0.60.0_linux_amd64.tar.gz
tar -xzf frp_0.60.0_linux_amd64.tar.gz
cd frp_0.60.0_linux_amd64

# 配置 frps.toml
cat > frps.toml << 'EOF'
bindPort = 7000
auth.method = "token"
auth.token = "your-secret-token"
EOF

# 启动服务端
./frps -c frps.toml
```

```bash
# 在 4070 TiS 电脑上配置 frpc（客户端）
# frpc.toml
serverAddr = "你的ECS公网IP"
serverPort = 7000
auth.method = "token"
auth.token = "your-secret-token"

[[proxies]]
name = "ollama"
type = "tcp"
localPort = 11434
remotePort = 11434
```

### 10.3 更新 ECS 环境变量

```bash
# 修改 .env
cat > .env << 'EOF'
# 注释掉阿里云配置
# LLM_API_KEY=sk-xxxxx
# LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# LLM_MODEL=qwen-plus

# 使用本地 Ollama（通过 frp 内网穿透）
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:14b-q4_0
EOF

# 重启服务
docker compose restart api agent-runtime
```

---

## 快速检查清单

部署前确认：
- [ ] 阿里云百炼账号已创建
- [ ] API Key 已生成并记录
- [ ] 所需模型已开通
- [ ] ECS 公网 IP 可以访问
- [ ] .env 文件中的 LLM_API_KEY 已更新

部署后验证：
- [ ] `docker compose ps` 显示所有容器 Up
- [ ] `curl http://localhost` 返回 HTML
- [ ] `docker compose logs api | grep -i llm` 显示连接成功
- [ ] 浏览器访问 ECS 公网 IP 能看到页面

---

**有问题？** 查看日志：`docker compose logs -f api`
