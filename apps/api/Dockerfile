# API Dockerfile - Production Optimized

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy only package files for better caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/agent-runtime/package.json ./apps/agent-runtime/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install

# ============================================
# Stage 2: Builder
# ============================================
FROM deps AS builder
WORKDIR /app

# Copy source code (包括预构建的 dist)
COPY . .

# 确保 workspace 依赖的 dist 存在
RUN test -d apps/agent-runtime/dist || (echo "Error: agent-runtime/dist not found" && exit 1)

# 使用预构建的 dist（项目有 TS 错误，避免在容器中重新编译）
RUN cd packages/types && pnpm build
RUN echo "Using pre-built dist from host"

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-alpine AS production
WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER appuser

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
