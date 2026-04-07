# AgentHive API 启动指南

## 🚀 快速启动（3步）

### 步骤 1: 启动 PostgreSQL

**方式 A: Windows 服务**
```powershell
# 检查 PostgreSQL 服务状态
Get-Service -Name "postgresql*"

# 启动服务
net start postgresql-x64-15
# 或
Start-Service -Name "postgresql-x64-15"
```

**方式 B: 手动启动**
```powershell
# 切换到 postgres 用户并启动
& "C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\15\data"
```

**方式 C: 使用 Docker**
```bash
docker run -d \
  --name agenthive-postgres \
  -e POSTGRES_USER=agenthive \
  -e POSTGRES_PASSWORD=agenthive123 \
  -e POSTGRES_DB=agenthive \
  -p 5432:5432 \
  postgres:15-alpine
```

---

### 步骤 2: 启动 Redis

**方式 A: Windows 服务**
```powershell
# 检查服务
Get-Service -Name "Redis*"

# 启动服务
Start-Service -Name "Redis"
```

**方式 B: 手动启动**
```powershell
# 在新窗口运行
redis-server

# 或使用配置文件
redis-server "C:\ProgramData\chocolatey\lib\redis-64\redis.windows.conf"
```

**方式 C: 使用 Docker**
```bash
docker run -d \
  --name agenthive-redis \
  -p 6379:6379 \
  redis:7-alpine
```

---

### 步骤 3: 启动 API 服务器

```bash
cd E:\Git\ai-digital-twin\agenthive-cloud\apps\api

# 安装依赖（首次）
npm install

# 初始化数据库（首次）
npm run db:init

# 启动开发服务器
npm run dev
```

---

## 🌐 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| **API 服务器** | http://localhost:3001 | REST API |
| **API 文档** | http://localhost:3001/api/health | 健康检查端点 |
| **WebSocket** | ws://localhost:3001 | Socket.io |

---

## 📋 完整启动脚本（Windows PowerShell）

创建 `start-all.ps1`:

```powershell
# AgentHive Backend Startup Script

Write-Host "🚀 Starting AgentHive Backend Services..." -ForegroundColor Green

# 1. Start PostgreSQL
try {
    $pgService = Get-Service -Name "postgresql*" -ErrorAction Stop
    if ($pgService.Status -ne 'Running') {
        Write-Host "📦 Starting PostgreSQL..." -ForegroundColor Yellow
        Start-Service -Name $pgService.Name
        Start-Sleep -Seconds 3
    }
    Write-Host "✅ PostgreSQL is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️ PostgreSQL service not found. Please start manually or use Docker." -ForegroundColor Red
}

# 2. Start Redis
try {
    $redisService = Get-Service -Name "Redis*" -ErrorAction Stop
    if ($redisService.Status -ne 'Running') {
        Write-Host "📦 Starting Redis..." -ForegroundColor Yellow
        Start-Service -Name $redisService.Name
        Start-Sleep -Seconds 2
    }
    Write-Host "✅ Redis is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Redis service not found. Starting Redis manually..." -ForegroundColor Yellow
    Start-Process redis-server -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "✅ Redis started" -ForegroundColor Green
}

# 3. Check ports
Write-Host ""
Write-Host "🔍 Checking service ports..." -ForegroundColor Cyan

$pgPort = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
if ($pgPort.TcpTestSucceeded) {
    Write-Host "✅ PostgreSQL port 5432 is open" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL port 5432 is not accessible" -ForegroundColor Red
}

$redisPort = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
if ($redisPort.TcpTestSucceeded) {
    Write-Host "✅ Redis port 6379 is open" -ForegroundColor Green
} else {
    Write-Host "❌ Redis port 6379 is not accessible" -ForegroundColor Red
}

# 4. Start API Server
Write-Host ""
Write-Host "🌐 Starting API Server..." -ForegroundColor Cyan
Write-Host "📍 Location: E:\Git\ai-digital-twin\agenthive-cloud\apps\api" -ForegroundColor Gray

Set-Location E:\Git\ai-digital-twin\agenthive-cloud\apps\api

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if database is initialized
Write-Host "🗄️  Checking database..." -ForegroundColor Yellow
node -e "
import { pool } from './src/config/database.js';
import { readFileSync } from 'fs';

async function init() {
  try {
    const client = await pool.connect();
    const result = await client.query(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')\");
    client.release();
    
    if (!result.rows[0].exists) {
      console.log('Database not initialized. Running init...');
      process.exit(1);
    } else {
      console.log('Database is ready');
      process.exit(0);
    }
  } catch (e) {
    console.log('Database error:', e.message);
    process.exit(1);
  }
}
init();
" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "🗄️  Initializing database..." -ForegroundColor Yellow
    npm run db:init
}

Write-Host ""
Write-Host "🚀 Starting API server on http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Available endpoints:" -ForegroundColor Cyan
Write-Host "   - API: http://localhost:3001/api" -ForegroundColor Gray
Write-Host "   - Health: http://localhost:3001/api/health" -ForegroundColor Gray
Write-Host "   - WebSocket: ws://localhost:3001" -ForegroundColor Gray
Write-Host ""

npm run dev
```

---

## 🐳 Docker Compose 一键启动

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: agenthive-postgres
    environment:
      POSTGRES_USER: agenthive
      POSTGRES_PASSWORD: agenthive123
      POSTGRES_DB: agenthive
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agenthive"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: agenthive-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: .
    container_name: agenthive-api
    environment:
      - NODE_ENV=development
      - PORT=3001
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=agenthive
      - DB_USER=agenthive
      - DB_PASSWORD=agenthive123
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=your-secret-key-change-in-production
      - CORS_ORIGIN=http://localhost:3000
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
```

启动命令：
```bash
docker-compose up -d
```

---

## 🔍 验证服务状态

```powershell
# 检查所有端口
Test-NetConnection -ComputerName localhost -Port 5432  # PostgreSQL
Test-NetConnection -ComputerName localhost -Port 6379  # Redis
Test-NetConnection -ComputerName localhost -Port 3001  # API

# 检查进程
Get-Process redis-server,postgres,node

# 测试 API
curl http://localhost:3001/api/health
```

---

## 🛑 停止服务

```powershell
# 停止 API
Ctrl + C

# 停止 PostgreSQL
net stop postgresql-x64-15

# 停止 Redis
Stop-Process -Name redis-server

# 或使用 Docker
docker-compose down
```

---

## 📞 连接信息

| 服务 | 主机 | 端口 | 用户名 | 密码 |
|------|------|------|--------|------|
| PostgreSQL | localhost | 5432 | agenthive | agenthive123 |
| Redis | localhost | 6379 | - | - |
| API | localhost | 3001 | - | - |

---

## 🆘 故障排除

### PostgreSQL 连接失败
```powershell
# 检查服务状态
Get-Service -Name "postgresql*"

# 查看日志
Get-Content "C:\Program Files\PostgreSQL\15\data\log\*.log" -Tail 50
```

### Redis 连接失败
```powershell
# 检查 Redis 是否运行
redis-cli ping

# 手动启动
redis-server --daemonize yes
```

### API 启动失败
```bash
# 清除 node_modules 重新安装
rm -rf node_modules
npm install

# 检查 TypeScript 编译
npx tsc --noEmit
```
