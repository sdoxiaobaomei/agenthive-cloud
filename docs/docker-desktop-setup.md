# AgentHive Cloud - Docker Desktop 本地部署指南

> 适用于 Windows、macOS 和 Linux 的 Docker Desktop 环境

---

## 📋 前置要求

### 必需软件

| 软件 | 最低版本 | 下载链接 |
|------|---------|---------|
| Docker Desktop | 4.25+ | [下载](https://www.docker.com/products/docker-desktop) |
| Git | 2.30+ | [下载](https://git-scm.com/downloads) |
| Make | 可选 | (Windows: 使用 Git Bash 或 WSL) |

### 系统要求

- **Windows**: Windows 10/11 (64-bit), WSL2 后端
- **macOS**: macOS 11+ (Apple Silicon 或 Intel)
- **Linux**: 支持 Docker 的 Linux 发行版

### 资源建议

- **CPU**: 4+ 核心
- **内存**: 8GB+ (推荐 12GB)
- **磁盘**: 20GB+ 可用空间

---

## 🚀 快速开始

### 1. 克隆代码仓库

```bash
git clone <your-repo-url>
cd agenthive-cloud
```

### 2. 配置环境变量

```bash
# 复制本地开发环境配置
cp .env.local .env

# (可选) 编辑配置
nano .env  # 或 code .env
```

### 3. 启动服务

**方式一：使用脚本（推荐）**

```bash
# 启动所有服务
./scripts/local-docker.sh start

# 查看帮助
./scripts/local-docker.sh help
```

**方式二：使用 Make**

```bash
# 启动开发环境
make dev-docker
```

**方式三：使用 Docker Compose 直接启动**

```bash
# 复制环境配置
cp .env.local .env

# 启动服务
docker-compose up --build -d
```

### 4. 访问服务

服务启动后，可通过以下地址访问：

| 服务 | URL | 说明 |
|------|-----|------|
| Web 前端 | http://localhost:5173 | React + Vite 开发服务器 |
| API 后端 | http://localhost:8080 | Go Supervisor API |
| API 文档 | http://localhost:8080/swagger/index.html | Swagger UI |
| PostgreSQL | localhost:5432 | 数据库 |
| Redis | localhost:6379 | 缓存 |

---

## 📁 项目结构

```
agenthive-cloud/
├── apps/
│   ├── web/              # 前端应用 (React + Vite)
│   ├── supervisor/       # 后端 API (Go)
│   └── agent-runtime/    # Agent 运行时
├── scripts/
│   ├── local-docker.sh   # 本地部署脚本 ⭐
│   ├── health-check.sh   # 健康检查脚本 ⭐
│   └── setup.sh          # 初始化脚本
├── config/               # 配置文件
├── init-scripts/         # 数据库初始化脚本
├── docker-compose.yml    # 主 Docker Compose 配置
├── docker-compose.override.yml  # 本地开发覆盖配置
├── .env.local           # 本地环境模板
└── Makefile             # 常用命令
```

---

## 🔧 详细配置

### 环境变量说明

编辑 `.env` 文件来自定义配置：

```bash
# 数据库配置
DB_HOST=postgres
DB_PORT=5432
DB_USER=agenthive
DB_PASSWORD=agenthive_local
DB_NAME=agenthive_local

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_local_secret

# 服务端口
SUPERVISOR_PORT=8080
WEB_PORT=5173

# 前端 API 地址
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws

# 日志级别
LOG_LEVEL=debug
```

### 端口冲突解决

如果端口被占用，修改 `.env` 文件：

```bash
# 修改 PostgreSQL 端口 (默认 5432)
DB_PORT=5433

# 修改 Redis 端口 (默认 6379)
REDIS_PORT=6380

# 修改 API 端口 (默认 8080)
SUPERVISOR_PORT=8081

# 修改前端端口 (默认 5173)
WEB_PORT=5174
```

修改后同步更新前端 API 地址：

```bash
VITE_API_BASE_URL=http://localhost:8081/api
VITE_WS_URL=ws://localhost:8081/ws
```

---

## 🛠️ 常用命令

### 服务管理

```bash
# 启动服务
./scripts/local-docker.sh start

# 停止服务
./scripts/local-docker.sh stop

# 重启服务
./scripts/local-docker.sh restart

# 查看状态
./scripts/local-docker.sh status
```

### 日志查看

```bash
# 查看所有日志
./scripts/local-docker.sh logs

# 实时跟踪日志
./scripts/local-docker.sh logs -f

# 仅查看前端日志
./scripts/local-docker.sh logs-web -f

# 仅查看后端日志
./scripts/local-docker.sh logs-api -f
```

### 调试工具

```bash
# 进入前端容器 shell
./scripts/local-docker.sh shell-web

# 进入后端容器 shell
./scripts/local-docker.sh shell-api

# 连接数据库
./scripts/local-docker.sh db-connect

# 连接 Redis
./scripts/local-docker.sh redis-cli
```

### 健康检查

```bash
# 运行完整健康检查
./scripts/local-docker.sh health

# 或使用直接调用
./scripts/health-check.sh
```

---

## 🔥 热重载开发

### 前端热重载

前端使用 Vite 开发服务器，支持：

- **即时更新**: 修改代码后自动刷新浏览器
- **HMR (热模块替换)**: 组件级更新，不丢失状态
- **TypeScript 支持**: 自动类型检查

### 后端热重载

后端使用 `air` 工具实现热重载：

- 修改 Go 代码后自动重新编译
- 保留数据库连接
- 自动运行测试

### 配置热重载

- 前端配置文件修改后自动生效
- 后端配置文件需重启服务

---

## 🧪 验证部署

### 1. 检查容器状态

```bash
docker-compose ps
```

预期输出：
```
NAME                    STATUS          PORTS
agenthive-postgres      Up (healthy)    0.0.0.0:5432->5432/tcp
agenthive-redis         Up (healthy)    0.0.0.0:6379->6379/tcp
agenthive-supervisor-dev Up (healthy)   0.0.0.0:8080->8080/tcp
agenthive-web-dev       Up (healthy)    0.0.0.0:5173->5173/tcp
```

### 2. 测试 Web 前端

```bash
curl http://localhost:5173/
# 应返回 HTML 内容
```

浏览器访问: http://localhost:5173

### 3. 测试 API 后端

```bash
# 健康检查
curl http://localhost:8080/health
# 预期: {"status":"healthy"}

# 获取 Agents 列表
curl http://localhost:8080/api/agents
# 预期: JSON 格式的 agents 数据
```

### 4. 测试数据库连接

```bash
# 使用脚本连接
./scripts/local-docker.sh db-connect

# 或在容器内执行
psql -h localhost -p 5432 -U agenthive -d agenthive_local
```

### 5. 测试 Redis 连接

```bash
# 使用脚本连接
./scripts/local-docker.sh redis-cli

# 测试命令
127.0.0.1:6379> ping
PONG
```

---

## 🐛 故障排除

### 问题：端口被占用

**错误信息**:
```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

**解决方案**:
1. 查找占用端口的进程:
   ```bash
   # Windows
   netstat -ano | findstr :5432
   
   # macOS/Linux
   lsof -i :5432
   ```

2. 停止占用端口的服务，或修改 `.env` 使用其他端口:
   ```bash
   DB_PORT=5433
   ```

### 问题：容器启动失败

**检查日志**:
```bash
./scripts/local-docker.sh logs
```

**常见问题**:
- 内存不足: 增加 Docker Desktop 内存限制
- 镜像拉取失败: 检查网络连接或配置镜像加速
- 构建失败: 清理缓存后重试

### 问题：数据库连接失败

**检查步骤**:
1. 确认 PostgreSQL 容器运行:
   ```bash
   docker-compose ps postgres
   ```

2. 检查数据库日志:
   ```bash
   ./scripts/local-docker.sh logs-api
   ```

3. 确认环境变量正确:
   ```bash
   cat .env | grep DB_
   ```

### 问题：热重载不工作

**前端**:
- 确认 `CHOKIDAR_USEPOLLING=true` 在 `.env` 中
- Docker Desktop 设置中启用文件共享

**后端**:
- 确认使用 `development` target 构建
- 检查 `.air.toml` 配置存在

### 问题：Windows 路径问题

**解决方案**:
1. 使用 WSL2 后端 (推荐)
2. 在 `.env` 中设置:
   ```bash
   COMPOSE_CONVERT_WINDOWS_PATHS=1
   ```

---

## 🧹 清理和维护

### 停止并清理

```bash
# 停止服务 (保留数据)
./scripts/local-docker.sh stop

# 清理容器和数据卷 (⚠️ 数据丢失)
./scripts/local-docker.sh clean
```

### 更新镜像

```bash
# 拉取最新基础镜像
docker-compose pull

# 重建服务
docker-compose up --build -d
```

### 备份数据

```bash
# 备份数据库
docker exec agenthive-postgres pg_dump -U agenthive agenthive_local > backup.sql

# 备份 Redis
docker exec agenthive-redis redis-cli SAVE
docker cp agenthive-redis:/data/dump.rdb ./redis-backup.rdb
```

---

## 📝 Docker Desktop 特定设置

### Windows 设置

1. **启用 WSL2 集成**:
   - Docker Desktop Settings → Resources → WSL Integration
   - 启用你的 WSL 发行版

2. **文件共享**:
   - Docker Desktop Settings → Resources → File sharing
   - 添加项目目录

3. **资源限制**:
   - Docker Desktop Settings → Resources
   - 建议: CPU 4+, Memory 8GB+

### macOS 设置

1. **文件共享优化**:
   - Docker Desktop Settings → Resources → File sharing
   - 使用 `osxfs` 或 `gRPC FUSE`

2. **资源限制**:
   - Docker Desktop Settings → Resources
   - 建议: CPU 4+, Memory 8GB+

---

## 🔐 安全注意事项

- **JWT 密钥**: 生产环境务必修改 `JWT_SECRET`
- **数据库密码**: 本地开发使用简单密码，生产环境使用强密码
- **CORS 设置**: 生产环境限制 `CORS_ALLOWED_ORIGINS`

---

## 📚 相关文档

- [项目 README](../README.md)
- [部署指南](../DEPLOYMENT.md)
- [API 文档](http://localhost:8080/swagger/index.html) (服务启动后)

---

## 💡 提示

1. **首次启动较慢**: 需要下载镜像和构建，请耐心等待
2. **Docker Desktop 启动**: 确保 Docker Desktop 完全启动后再运行脚本
3. **防火墙**: 确保防火墙允许本地端口通信

---

如有问题，请提交 Issue 或联系开发团队。
