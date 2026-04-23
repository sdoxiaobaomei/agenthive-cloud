# syntax=docker/dockerfile:1
# Agent Runtime Service - Production Optimized
# Pre-requisite: run `pnpm -r build` from repo root.
# Build command (from repo root):
#   docker build -f apps/agent-runtime/Dockerfile -t agenthive/agent-runtime:<tag> .
#
# Expected image size: ~150-220 MB (vs 1GB+ before)

# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml ./
COPY packages/observability/package.json ./packages/observability/
COPY apps/agent-runtime/package.json ./apps/agent-runtime/

RUN pnpm install --frozen-lockfile

# Copy pre-built dist artifacts
COPY packages/observability/dist ./packages/observability/dist
COPY apps/agent-runtime/dist ./apps/agent-runtime/dist

# Deploy production bundle
RUN pnpm --filter=@agenthive/agent-runtime deploy --prod /prod/agent-runtime

# ============ 生产阶段 ============
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init and git (simple-git dependency requires git CLI)
RUN apk add --no-cache dumb-init git

# Create non-root user with workspace directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p /workspace && \
    chown -R nodejs:nodejs /workspace /app

# Copy deployed production bundle
COPY --from=builder --chown=nodejs:nodejs /prod/agent-runtime .

USER nodejs

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
