# API Service - Production Optimized (pnpm monorepo)
# Uses pnpm deploy for minimal production bundle.
# Pre-requisite: run `pnpm -r build` (or `cd apps/api && pnpm build`) from repo root.
# Build command (from repo root):
#   docker build -f apps/api/Dockerfile -t agenthive/api:<tag> .
#
# Expected image size: ~180-250 MB (vs 1GB+ before)

# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm globally (pinned for reproducibility)
RUN npm install -g pnpm@9

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml ./
COPY packages/observability/package.json ./packages/observability/
COPY apps/agent-runtime/package.json ./apps/agent-runtime/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (needed for deploy to resolve workspace links)
RUN pnpm install --frozen-lockfile

# Copy pre-built dist artifacts (assumes `pnpm -r build` was run on host)
COPY packages/observability/dist ./packages/observability/dist
COPY apps/agent-runtime/dist ./apps/agent-runtime/dist
COPY apps/api/dist ./apps/api/dist

# Deploy production bundle (extracts only prod deps + workspace dist)
RUN pnpm --filter=@agenthive/api deploy --prod /prod/api

# ============ 生产阶段 ============
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Create workspace data directory with proper ownership
RUN mkdir -p /data/workspaces && chown -R appuser:nodejs /data

# Declare workspace as a volume for persistence
VOLUME /data/workspaces

# Copy the deployed production bundle (already contains dist + prod node_modules)
COPY --from=builder --chown=appuser:nodejs /prod/api .

# Copy templates directory for blank project initialization
COPY --chown=appuser:nodejs apps/api/templates ./apps/api/templates

# Switch to non-root user
USER appuser

ENV NODE_ENV=production
ENV PORT=3001
ENV WORKSPACE_BASE=/data/workspaces
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
