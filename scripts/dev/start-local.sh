#!/bin/bash
# AgentHive 本地开发启动脚�?# 使用本地 Ollama，其他服务用 Docker

set -e

echo "🚀 AgentHive 本地开发环境启�?
echo "================================"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检�?Ollama
log "检�?Ollama 服务..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    error "Ollama 未运行！请先启动 Ollama"
    echo ""
    echo "启动命令:"
    echo "  Windows: ollama serve"
    echo "  macOS:   brew services start ollama"
    echo "  Linux:   sudo systemctl start ollama"
    exit 1
fi

# 获取当前模型
MODEL=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
log "�?Ollama 运行中，模型: $MODEL"

# 生成环境变量
if [ ! -f .env ]; then
    log "生成 .env 配置文件..."
    cat > .env << EOF
# 本地开发配�?DB_PASSWORD=devpassword123
JWT_SECRET=$(openssl rand -base64 32)

# Ollama 本地配置
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen3:14b
EOF
    log "�?.env 已生�?
fi

# 创建必要的目�?mkdir -p apps/apps/landing/.output/public
mkdir -p nginx/conf.d

# 检�?docker
docker info > /dev/null 2>&1 || {
    error "Docker 未运行！"
    exit 1
}

# 启动服务
log "启动 Docker 服务..."
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build -d

# 等待服务启动
log "等待服务初始�?.."
sleep 5

# 检查服务状�?log "检查服务状�?.."
for service in agenthive-api agenthive-landing agenthive-db agenthive-redis; do
    if docker ps | grep -q "$service"; then
        log "�?$service 运行正常"
    else
        warn "⚠️ $service 可能未正常启�?
    fi
done

# 检�?API 健康
log "检�?API 服务..."
for i in {1..10}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        log "�?API 服务就绪"
        break
    fi
    if [ $i -eq 10 ]; then
        warn "⚠️ API 服务启动较慢，请稍后重试"
    fi
    sleep 2
done

# 打印访问信息
echo ""
echo "================================"
echo "🎉 AgentHive 启动成功�?
echo "================================"
echo ""
echo "访问地址:"
echo "  🌐 Landing: http://localhost"
echo "  📡 API:     http://localhost:3001"
echo "  📚 API文档: http://localhost:3001/api/health"
echo ""
echo "LLM 配置:"
echo "  🔗 Ollama:  http://localhost:11434"
echo "  🤖 模型:    qwen3:14b (本地)"
echo ""
echo "常用命令:"
echo "  查看日志:  docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f api"
echo "  停止服务:  docker compose -f docker-compose.dev.yml --env-file .env.dev down"
echo "  重启服务:  docker compose -f docker-compose.dev.yml --env-file .env.dev restart"
echo ""
echo "================================"
