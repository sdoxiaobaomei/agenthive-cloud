# GitHub Actions 部署到 ECS —— 详细操作手册

> 目标：Push 代码到 GitHub → 自动部署到 8C16G ECS（39.107.87.106）

---

## 前置条件检查清单

- [ ] 你已经在本地 `git clone` 了项目，且能正常 `git push`
- [ ] 你的私钥文件 `ecs-login`（或 `ecs-login.pem`）在手边
- [ ] 你能通过 `ssh -i ecs-login root@39.107.87.106` 连上 8C16G ECS
- [ ] 8C16G ECS 上已安装 Docker 和 Git

---

## 第一步：在 8C16G ECS 上初始化项目（只执行一次）

### 1.1 SSH 登录 ECS

```bash
# Windows PowerShell / Linux / Mac 通用
ssh -i ~/.ssh/ecs-login root@39.107.87.106
```

如果提示 `Are you sure you want to continue connecting?`，输入 `yes`。

### 1.2 安装必要软件

```bash
# 阿里云 Linux 3（兼容 CentOS 8）
yum install -y git docker docker-compose-plugin

# 启动 Docker
systemctl enable --now docker
docker --version        # 应输出 20.x 或 24.x
docker compose version  # 应输出 2.x
```

### 1.3 克隆项目到固定目录

```bash
mkdir -p /opt
cd /opt

# 用 HTTPS（推荐，最简单）
git clone https://github.com/你的GitHub用户名/agenthive-cloud.git

# 或者用 SSH（如果你配了 GitHub SSH Key）
# git clone git@github.com:你的GitHub用户名/agenthive-cloud.git

cd /opt/agenthive-cloud
ls -la    # 确认能看到 docker-compose.demo.yml
```

### 1.4 创建环境变量文件

```bash
cd /opt/agenthive-cloud
cp .env.demo .env.demo.local
chmod 600 .env.demo.local    # 只允许 root 读写
```

**编辑 `.env.demo.local`**：

```bash
nano /opt/agenthive-cloud/.env.demo.local
```

填入以下内容（把 xxx 换成你的真实值）：

```env
# === 数据层（2C2G ECS 内网地址）===
DB_HOST=172.24.146.165
DB_PORT=5432
DB_NAME=agenthive
DB_USER=agenthive
DB_PASSWORD=你的PostgreSQL密码

REDIS_HOST=172.24.146.165
REDIS_PORT=6379
REDIS_PASSWORD=你的Redis密码（没有就留空）

# === LLM: Kimi Code API ===
# 获取地址：https://platform.kimi.com/
LLM_API_KEY=sk-你的KimiCodeAPIKey
LLM_BASE_URL=https://api.kimi.com/coding/v1
LLM_MODEL=kimi-code

# === Cloudflare Tunnel（可选，外部访客访问用）===
# https://one.dash.cloudflare.com/ -> Networks -> Tunnels
CF_TUNNEL_TOKEN=你的CloudflareTunnelToken

# === 基础配置 ===
JWT_SECRET=随便改一个32位以上的随机字符串
DEMO_PORT=80
API_PORT=3001
LANDING_PORT=3000

# === Java 微服务（可选）===
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# === 监控（可选）===
GRAFANA_PASSWORD=admin123
```

保存：`Ctrl+O` → 回车 → `Ctrl+X` 退出 nano。

### 1.5 测试手动启动（确保能跑起来）

```bash
cd /opt/agenthive-cloud

# 启动基础服务（Node.js API + Landing + Nginx）
docker compose -f docker-compose.demo.yml --env-file .env.demo.local up -d

# 查看状态
docker compose -f docker-compose.demo.yml ps

# 测试 API 健康接口
curl http://localhost:3001/api/health
# 应返回 {"status":"ok"} 或类似内容
```

如果这一步成功了，说明 ECS 环境准备好了。**记下这个命令，后面改代码不需要再配环境。**

---

## 第二步：准备 GitHub Secrets

### 2.1 把私钥转成文本格式

在你的**本地电脑**（Windows/Mac/Linux）上执行：

```bash
# 找到私钥文件
# Windows 通常在 C:\Users\你的用户名\Downloads\ecs-login.pem
# Mac/Linux 通常在 ~/.ssh/ecs-login

# 查看私钥内容（别发给别人！）
cat ~/.ssh/ecs-login
# 或者 Windows PowerShell:
# Get-Content C:\Users\你的用户名\Downloads\ecs-login.pem
```

你应该看到类似这样的内容：

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
...
-----END OPENSSH PRIVATE KEY-----
```

**把这段内容完整复制下来**（包括 BEGIN 和 END 两行）。

### 2.2 在 GitHub 上配置 Secrets

1. 打开你的 GitHub 仓库页面
2. 点击顶部菜单 **Settings**
3. 左侧菜单找到 **Secrets and variables** → **Actions**
4. 点击绿色按钮 **New repository secret**

#### Secret 1: `ECS_SSH_KEY`

| 字段 | 值 |
|------|-----|
| **Name** | `ECS_SSH_KEY` |
| **Secret** | 把你刚才复制的私钥全文粘贴进来 |

点击 **Add secret**

#### Secret 2: `ENV_DEMO_LOCAL`

| 字段 | 值 |
|------|-----|
| **Name** | `ENV_DEMO_LOCAL` |
| **Secret** | 把 `/opt/agenthive-cloud/.env.demo.local` 的**全部内容**粘贴进来 |

> 作用：如果 ECS 上还没有 `.env.demo.local`，GitHub Actions 会自动从 Secrets 创建它。

### 2.3 确认 Secrets 列表

配置完成后，你应该看到两个 Secrets：

```
✓ ECS_SSH_KEY      (Updated x minutes ago)
✓ ENV_DEMO_LOCAL   (Updated x minutes ago)
```

---

## 第三步：触发第一次自动部署

### 3.1 在本地改点什么（任意文件都行）

```bash
# 在你的本地项目目录
cd E:\Git\agenthive-cloud    # Windows
cd ~/agenthive-cloud         # Mac/Linux

# 随便改个文件，比如 README.md
echo "# Deployed via GitHub Actions" >> README.md

# 提交并推送
git add .
git commit -m "chore: setup GitHub Actions deployment"
git push origin main
```

### 3.2 在 GitHub 上看部署进度

1. 打开 GitHub 仓库页面
2. 点击顶部 **Actions** 标签
3. 你应该看到一条正在运行的 workflow：`Deploy to ECS`
4. 点击进去，可以看到每一步的日志：
   - `Setup SSH known_hosts`
   - `Inject .env file to ECS`
   - `Deploy via SSH`
   - `Cleanup old images`

### 3.3 成功的标志

在 `Deploy via SSH` 步骤的日志里，你应该看到：

```
=== [1/5] 拉取最新代码 ===
当前 commit: a1b2c3d

=== [2/5] 构建并启动服务 ===
...

=== [5/5] 健康检查 ===
✅ API 健康检查通过

=== 🎉 部署完成 ===
```

---

## 第四步：验证部署结果

### 4.1 SSH 到 ECS 检查

```bash
ssh -i ~/.ssh/ecs-login root@39.107.87.106

docker compose -f /opt/agenthive-cloud/docker-compose.demo.yml ps
# 应看到 nginx / api / landing 都是 Up 状态
```

### 4.2 浏览器访问

```
http://39.107.87.106          # Nginx 入口
http://39.107.87.106:3000     # Landing (Nuxt)
http://39.107.87.106:3001/api/health   # API 健康检查
```

如果开了 Cloudflare Tunnel，用 Tunnel 的域名访问。

---

## 第五步：日常开发流程（之后每次改代码）

```bash
# 1. 本地改代码
git add .
git commit -m "feat: xxx"
git push origin main

# 2. 去 GitHub Actions 页面看部署状态（等 1-2 分钟）
# https://github.com/你的用户名/agenthive-cloud/actions

# 3. 部署完成后刷新浏览器看效果
```

---

## 手动触发部署（不 push 代码）

GitHub 仓库 → Actions → Deploy to ECS → 右侧 **Run workflow** → 点击绿色按钮

可选参数：
- **强制重新构建镜像**：勾选后不用缓存，全量 rebuild
- **同时启动 Java 微服务**：勾选后加 `--profile java`
- **同时启动监控栈**：勾选后加 `--profile monitoring`

---

## 故障排查

### 问题 1：Actions 报错 `Permission denied (publickey)`

原因：私钥不对，或者 ECS 上没有对应公钥。

解决：
```bash
# SSH 到 ECS
ssh -i ~/.ssh/ecs-login root@39.107.87.106

# 检查 authorized_keys 里有没有你的公钥
cat ~/.ssh/authorized_keys

# 如果没有，把公钥加进去
cat ~/.ssh/ecs-login.pub >> ~/.ssh/authorized_keys
# 注意是 .pub（公钥），不是私钥！
```

### 问题 2：Actions 报错 `git fetch origin` 失败

原因：ECS 上的 `/opt/agenthive-cloud` 目录可能不存在，或者 git 仓库配的是 HTTPS/SSH 有问题。

解决：
```bash
ssh -i ~/.ssh/ecs-login root@39.107.87.106
cd /opt/agenthive-cloud
git remote -v    # 确认 remote 是你的 GitHub 仓库
```

### 问题 3：API 健康检查失败

原因：可能是数据库连不上，或者 `.env.demo.local` 配置有误。

解决：
```bash
ssh -i ~/.ssh/ecs-login root@39.107.87.106
cd /opt/agenthive-cloud

# 看 API 日志
docker compose -f docker-compose.demo.yml --env-file .env.demo.local logs --tail=50 api

# 检查数据库连通性
curl http://172.24.146.165:5432    # 不会返回 HTTP，但看是否超时
```

### 问题 4：部署成功了但页面没更新

原因：浏览器缓存，或者 Nginx 缓存了静态资源。

解决：
```bash
# SSH 到 ECS 重启 nginx
ssh -i ~/.ssh/ecs-login root@39.107.87.106
docker compose -f /opt/agenthive-cloud/docker-compose.demo.yml restart nginx
```

---

## 安全提醒

1. **`.env.demo.local` 和 `ECS_SSH_KEY` 永远不要提交到 Git**
   ```bash
   # 确认 .gitignore 里有这些
   cat .gitignore | grep -E "env|ssh|pem"
   ```

2. **定期更换 SSH Key**
   ```bash
   # 在 ECS 上生成新密钥对
   ssh-keygen -t ed25519 -f ~/.ssh/ecs-login-new
   
   # 把新公钥加到 authorized_keys
   cat ~/.ssh/ecs-login-new.pub >> ~/.ssh/authorized_keys
   
   # 把新私钥内容更新到 GitHub Secret `ECS_SSH_KEY`
   # 删除旧公钥（从 authorized_keys 里删掉旧的）
   ```

3. **GitHub Actions 日志是公开的**（除非仓库是 Private），不要在日志里打印密码。
