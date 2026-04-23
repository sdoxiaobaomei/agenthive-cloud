# GitHub Actions 部署说明

## 架构

```
GitHub Push → GitHub Actions (SSH) → 8C16G ECS (39.107.87.106)
                                           │
                                           ▼
                                    docker-compose up -d --build
                                           │
                                    连接 2C2G ECS (172.24.146.165)
                                    PostgreSQL + Redis
```

## 配置步骤

### 1. 在 8C16G ECS 上初始化项目（只需执行一次）

```bash
ssh root@39.107.87.106

# 安装 Git + Docker（阿里云 Linux 3）
yum install -y git docker docker-compose-plugin
systemctl enable --now docker

# 克隆项目
mkdir -p /opt
chmod 755 /opt
git clone https://github.com/你的用户名/agenthive-cloud.git /opt/agenthive-cloud
cd /opt/agenthive-cloud

# 创建环境文件
cp .env.demo .env.demo.local
# 编辑 .env.demo.local，填入：
#   DB_PASSWORD=xxx
#   REDIS_PASSWORD=xxx
#   LLM_API_KEY=sk-xxx
#   JWT_SECRET=xxx
#   CF_TUNNEL_TOKEN=xxx

# 测试启动
docker compose -f docker-compose.demo.yml --env-file .env.demo.local up -d
```

### 2. 配置 GitHub Secrets

进入 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | 值 | 获取方式 |
|-------------|-----|----------|
| `ECS_SSH_KEY` | 8C16G ECS 的私钥 | `cat ~/.ssh/id_rsa`（ECS 上生成的） |

**生成 SSH Key（如果还没有）**：
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions
# 把公钥放到 ECS 的 authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
# 把私钥内容复制到 GitHub Secrets
cat ~/.ssh/github_actions
```

### 3. 触发部署

```bash
# 本地改完代码
git add .
git commit -m "feat: xxx"
git push origin main

# GitHub Actions 会自动部署到 8C16G ECS
# 查看部署状态：GitHub 仓库 → Actions 标签页
```

### 4. 强制重新构建（清除缓存）

GitHub 仓库 → Actions → Deploy to ECS → Run workflow → rebuild 勾选 true

## 安全建议

1. **不要用密码登录 ECS**：SSH Key 比密码安全
2. **定期轮换 SSH Key**：
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_actions_new
   # 更新 GitHub Secret，删除旧公钥
   ```
3. **ECS 上不要存敏感文件**：`.env.demo.local` 里的 API Key 是唯一的敏感信息，确保它不在 git 里

## 故障排查

如果部署失败，SSH 到 ECS 检查：

```bash
cd /opt/agenthive-cloud
docker compose -f docker-compose.demo.yml logs --tail=100 api
docker compose -f docker-compose.demo.yml ps
```
