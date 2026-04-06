# Agent Runtime Dockerfile - Simplified for local build
FROM node:20-alpine

# 安装 git
RUN apk add --no-cache git

WORKDIR /app

# 复制 package 文件并安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY dist ./dist

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /workspace && \
    chown -R nodejs:nodejs /workspace /app

# 切换到非 root 用户
USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# 启动命令
CMD ["node", "dist/index.js"]
