# 单台 ECS 成本优化部署方案

> ⚠️ **严重过时** (最后检查: 2026-04-22)
>
> 本文档中的配置（端口、成本估算、Docker Compose）与实际项目状态严重不符。
> 当前项目已迁移到 Kubernetes 部署方案。
>
> ---
>
> **原标注**:
> **目标**: 所有服务运行在 1 台 ECS 实例上  
> **预算**: 最小化成本  
> **实际架构**: landing + api + agent-runtime (3个服务)

---

## 资源需求计算

### 服务内存占用估算

| 服务 | 基础内存 | 运行时峰值 | 优化后 | 说明 |
|------|----------|------------|--------|------|
| **Nginx** | 10 MB | 50 MB | **20 MB** | 静态文件 + 反向代理 |
| **Landing** (Nuxt 3 SSR) | 150 MB | 400 MB | **200 MB** | 营销站 + Web App |
| **API** (Node.js) | 150 MB | 400 MB | **200 MB** | Express 后端 |
| **Agent Runtime** | 200 MB | 1 GB | **300 MB** | Node.js + Git + 工具 |
| **PostgreSQL** | 100 MB | 500 MB | **200 MB** | 共享缓冲区 128MB |
| **Redis** | 10 MB | 100 MB | **30 MB** | 最大内存 64MB |
| **System/OS** | 300 MB | 500 MB | **400 MB** | Ubuntu + Docker |
| **Buffer** | - | - | **150 MB** | 安全缓冲 |
| **总计** | | | **~1.5 GB** | **建议配置: 2GB** |

### 架构确认

```
✅ 实际架构 (已验证):
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Alpine)                        │
│              20 MB - 反向代理 + 静态文件                  │
├─────────────────────────────────────────────────────────┤
│                    Landing (Nuxt 3)                      │
│             200 MB - SSR 渲染 (Landing + App)            │
├─────────────────────────────────────────────────────────┤
│                    API (Express)                         │
│              200 MB - REST API + WebSocket               │
├─────────────────────────────────────────────────────────┤
│                  Agent Runtime                           │
│           300 MB - AI Agent 执行环境                     │
├─────────────────────────────────────────────────────────┤
│              PostgreSQL + Redis                          │
│              230 MB - 数据存储 + 缓存                    │
└─────────────────────────────────────────────────────────┘

❌ 不存在的服务:
   - web (已合并到 landing)
```

### 最低配置 vs 推荐配置

```
最低配置 (1GB RAM + 2GB Swap):
├── 系统: 300 MB
├── 数据库: 150 MB
├── Redis: 30 MB
├── Landing: 150 MB
├── API: 150 MB
├── Agent: 200 MB
└── 缓冲: 100 MB
= 1.08 GB + Swap

推荐配置 (2GB RAM):
├── 系统: 400 MB
├── 数据库: 200 MB
├── Redis: 50 MB
├── Landing: 200 MB
├── API: 200 MB
├── Agent: 300 MB
├── Nginx: 20 MB
└── 缓冲: 630 MB
= 2GB (舒适运行)
```

---

## ECS 选型建议

### AWS EC2

| 实例类型 | vCPU | 内存 | 价格/月 | 适用性 |
|----------|------|------|---------|--------|
| t3.micro | 2 | 1 GB | ~$15 | ⚠️ 需 Swap |
| **t3.small** | 2 | **2 GB** | ~$30 | ✅ **推荐** |
| t3.medium | 2 | 4 GB | ~$60 | 理想 |

**节省成本技巧**:
- 使用 **Spot 实例**: 节省 60-70% (~$9-12/月)
- 使用 **Reserved 实例** (1年): 节省 40% (~$18/月)

### 国内云厂商 (推荐)

| 厂商 | 实例 | 配置 | 价格/月 | 特点 |
|------|------|------|---------|------|
| **阿里云** | ecs.t6-c1m1.large | 2vCPU 2GB | ~¥60 (~$8) | 最便宜 |
| **阿里云** | 新人优惠 | 2vCPU 2GB | ¥99/年 | ✅ **最推荐** |
| 腾讯云 | 轻量应用 | 2vCPU 2GB | ~¥50 (~$7) | 性价比高 |
| 华为云 | Flexus | 2vCPU 2GB | ~¥55 (~$8) | 稳定 |

---

## Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ==========================================
  # 反向代理 (20MB)
  # ==========================================
  nginx:
    image: nginx:alpine
    container_name: agenthive-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./landing/.output/public:/usr/share/nginx/html:ro
      - ./data/certbot/conf:/etc/letsencrypt:ro
      - ./data/certbot/www:/var/www/certbot:ro
    depends_on:
      - landing
      - api
      - agent-runtime
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 50M
        reservations:
          memory: 20M

  # ==========================================
  # Landing (Nuxt 3 SSR) - 200MB
  # ==========================================
  landing:
    image: node:20-alpine
    container_name: agenthive-landing
    working_dir: /app
    environment:
      - NODE_ENV=production
      - NUXT_PORT=3000
      - NUXT_PUBLIC_API_BASE=http://localhost:3001
      - REDIS_URL=redis://redis:6379
      # Node.js 内存限制
      - NODE_OPTIONS=--max-old-space-size=256
    volumes:
      - ./apps/landing/.output:/app/.output:ro
      - ./apps/landing/package.json:/app/package.json:ro
    command: node .output/server/index.mjs
    depends_on:
      - api
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 300M
        reservations:
          memory: 200M

  # ==========================================
  # API 服务 (Express) - 200MB
  # ==========================================
  api:
    image: node:20-alpine
    container_name: agenthive-api
    working_dir: /app
    volumes:
      - ./apps/api/dist:/app/dist:ro
      - ./apps/api/package.json:/app/package.json:ro
      - ./apps/api/node_modules:/app/node_modules
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=agenthive
      - DB_USER=agenthive
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - AGENT_RUNTIME_URL=http://agent-runtime:8080
      # Node.js 内存限制
      - NODE_OPTIONS=--max-old-space-size=256
    command: node dist/index.js
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 300M
        reservations:
          memory: 200M

  # ==========================================
  # Agent Runtime - 300MB
  # ==========================================
  agent-runtime:
    image: node:20-alpine
    container_name: agenthive-agent
    working_dir: /app
    volumes:
      - ./apps/agent-runtime/dist:/app/dist:ro
      - ./apps/agent-runtime/package.json:/app/package.json:ro
      - ./apps/agent-runtime/node_modules:/app/node_modules
      - agent-workspace:/workspace
    environment:
      - NODE_ENV=production
      - PORT=8080
      - WORKSPACE_PATH=/workspace
      - API_URL=http://api:3001
      - REDIS_URL=redis://redis:6379
      - LLM_API_KEY=${LLM_API_KEY}
      # Node.js 内存限制
      - NODE_OPTIONS=--max-old-space-size=512
    command: node dist/index.js
    depends_on:
      - api
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 600M
        reservations:
          memory: 300M

  # ==========================================
  # PostgreSQL - 200MB
  # ==========================================
  postgres:
    image: postgres:16-alpine
    container_name: agenthive-db
    environment:
      - POSTGRES_USER=agenthive
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=agenthive
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - postgres-data:/var/lib/postgresql/data
    command: >
      postgres
      -c shared_buffers=128MB
      -c effective_cache_size=384MB
      -c maintenance_work_mem=64MB
      -c work_mem=8MB
      -c max_connections=50
      -c logging_collector=off
      -c max_wal_size=1GB
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 300M
        reservations:
          memory: 200M

  # ==========================================
  # Redis - 30MB
  # ==========================================
  redis:
    image: redis:7-alpine
    container_name: agenthive-redis
    command: >
      redis-server
      --maxmemory 64mb
      --maxmemory-policy allkeys-lru
      --appendonly no
      --save ""
    volumes:
      - redis-data:/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 80M
        reservations:
          memory: 30M

volumes:
  postgres-data:
  redis-data:
  agent-workspace:
```

---

## Nginx 配置

```nginx
# nginx/conf.d/default.conf

upstream landing {
    server landing:3000 max_fails=3 fail_timeout=30s;
}

upstream api {
    server api:3001 max_fails=3 fail_timeout=30s;
}

upstream agent {
    server agent-runtime:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name _;
    
    # Certbot 验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Landing (Nuxt 3 SSR) - 包含 Landing + Web App
    location / {
        proxy_pass http://landing;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # API 代理
    location /api {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Agent Runtime WebSocket
    location /ws {
        proxy_pass http://agent;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://landing;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## 部署脚本

```bash
#!/bin/bash
# deploy.sh - 一键部署脚本

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查依赖
check_dependencies() {
    log "检查依赖..."
    command -v docker >/dev/null 2>&1 || { error "需要安装 Docker"; exit 1; }
    command -v docker-compose >/dev/null 2>&1 || { error "需要安装 Docker Compose"; exit 1; }
    docker info >/dev/null 2>&1 || { error "Docker 服务未运行"; exit 1; }
    log "依赖检查通过"
}

# 系统优化
optimize_system() {
    log "优化系统..."
    
    # Swap 配置
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -lt 2048 ] && [ ! -f /swapfile ]; then
        warn "内存小于 2GB，创建 2GB Swap..."
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    
    log "系统优化完成"
}

# 构建应用
build_apps() {
    log "构建应用..."
    
    # Build Landing
    if [ -d "apps/landing" ]; then
        log "构建 Landing..."
        cd apps/landing
        npm ci
        npm run build
        cd ../..
    fi
    
    # Build API
    if [ -d "apps/api" ]; then
        log "构建 API..."
        cd apps/api
        npm ci
        npm run build
        cd ../..
    fi
    
    # Build Agent Runtime
    if [ -d "apps/agent-runtime" ]; then
        log "构建 Agent Runtime..."
        cd apps/agent-runtime
        npm ci
        npm run build
        cd ../..
    fi
    
    log "构建完成"
}

# 生成环境配置
generate_env() {
    if [ ! -f ".env" ]; then
        log "生成环境配置..."
        
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-16)
        JWT_SECRET=$(openssl rand -base64 64)
        
        cat > .env << EOF
# Database
DB_PASSWORD=$DB_PASSWORD

# JWT
JWT_SECRET=$JWT_SECRET

# LLM API
LLM_API_KEY=your-llm-api-key-here
EOF
        
        log "环境配置已生成: .env"
        warn "请编辑 .env 文件，设置正确的 LLM_API_KEY"
    fi
}

# 启动服务
start_services() {
    log "启动服务..."
    
    export $(grep -v '^#' .env | xargs)
    
    docker-compose pull
    docker-compose up -d
    
    sleep 10
    
    # 健康检查
    log "健康检查..."
    
    services=("nginx" "landing" "api" "agent-runtime" "postgres" "redis")
    for service in "${services[@]}"; do
        if docker-compose ps | grep -q "agenthive-$service.*Up"; then
            log "✓ $service: 运行正常"
        else
            error "✗ $service: 启动失败"
            docker-compose logs $service
        fi
    done
    
    log "所有服务启动成功！"
}

# 显示状态
show_status() {
    echo ""
    echo "========================================"
    echo "      AgentHive 部署状态"
    echo "========================================"
    echo ""
    
    docker-compose ps
    
    echo ""
    echo "访问地址:"
    echo "  - Landing: http://localhost"
    echo "  - API:     http://localhost/api"
    echo "  - WS:      ws://localhost/ws"
    echo ""
    
    echo "资源使用:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep agenthive || true
    
    echo ""
    echo "总内存占用:"
    docker stats --no-stream --format "{{.MemUsage}}" 2>/dev/null | grep -E '[0-9.]+(MiB|GiB)' | awk 'BEGIN{sum=0} {gsub(/MiB/,""); gsub(/GiB/,"*1024"); sum+=$1} END{printf "%.1f MB\n", sum}'
    
    echo "========================================"
}

# 主函数
main() {
    case "${1:-deploy}" in
        deploy)
            check_dependencies
            optimize_system
            generate_env
            build_apps
            start_services
            show_status
            ;;
        build)
            build_apps
            ;;
        start)
            start_services
            show_status
            ;;
        stop)
            docker-compose down
            log "服务已停止"
            ;;
        restart)
            docker-compose restart
            sleep 5
            show_status
            ;;
        status)
            show_status
            ;;
        logs)
            docker-compose logs -f ${2:-}
            ;;
        *)
            echo "用法: $0 [deploy|build|start|stop|restart|status|logs]"
            exit 1
            ;;
    esac
}

main "$@"
```

---

## 成本对比

### 架构澄清

```
实际运行服务 (3个):
┌─────────────────────────────────────────────────────────┐
│  Landing (Nuxt 3)                                       │
│  ├── SSR 渲染营销页面                                    │
│  ├── 包含 Web App 功能 (已合并)                          │
│  └── 内存: 200 MB                                        │
├─────────────────────────────────────────────────────────┤
│  API (Express)                                          │
│  ├── REST API                                            │
│  ├── WebSocket Hub                                       │
│  └── 内存: 200 MB                                        │
├─────────────────────────────────────────────────────────┤
│  Agent Runtime                                          │
│  ├── AI Agent 执行                                       │
│  ├── Git 操作                                            │
│  └── 内存: 300 MB                                        │
└─────────────────────────────────────────────────────────┘

❌ 不存在: web (已合并到 landing)
```

### 费用对比

| 项目 | K8s 方案 | 单 ECS 方案 | 节省 |
|------|---------|-------------|------|
| 基础设施 | $185/月 | $0 | $185 |
| ECS (2GB) | - | $30/月 | - |
| **总计** | **$185/月** | **$30/月** | **84%** |

### 国内云厂商

| 厂商 | 配置 | 月费用 | 年费 |
|------|------|--------|------|
| 阿里云 (突发) | 2vCPU 2GB | ~¥60 | ~¥720 |
| **阿里云 (新人)** | 2vCPU 2GB | - | **¥99** ✅ |
| 腾讯云 | 2vCPU 2GB | ~¥50 | ~¥600 |

---

## 验证清单

部署后运行以下命令验证:

```bash
# 1. 检查所有容器运行状态
docker-compose ps

# 2. 检查内存使用
docker stats --no-stream

# 3. 检查服务健康

# Landing (应返回 HTML)
curl -s http://localhost | head -5

# API (应返回 JSON)
curl -s http://localhost/api/health

# Agent Runtime (通过 API 代理)
curl -s http://localhost/api/agents

# 4. 检查资源限制是否生效
docker inspect agenthive-landing | grep -A 5 Memory
```

---

## 总结

| 配置 | 内存需求 | 月费用 | 说明 |
|------|----------|--------|------|
| **最低** | 1GB + Swap | ~$8-15 | 个人开发 |
| **推荐** | **2GB** | ~$15-30 | ✅ 小型团队 |
| 舒适 | 4GB | ~$30-60 | 多人协作 |

**实际服务**: landing (Nuxt 3) + api (Express) + agent-runtime (Node.js)

**总内存**: ~1.5GB

**推荐**: 阿里云新人优惠 **¥99/年** (约 $14/年)
