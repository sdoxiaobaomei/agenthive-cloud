# API Service - Production Optimized (esbuild bundle + minimal runtime)
# Build command (from repo root):
#   docker build -f apps/api/Dockerfile -t agenthive/api:<tag> .
#
# Expected image size: ~80-120 MB (vs 323MB before)

# ============ Builder Stage ============
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm globally (pinned for reproducibility)
RUN npm install -g pnpm@9

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml ./
COPY packages ./packages
COPY apps ./apps

# Install all dependencies (needed for cross-workspace builds)
RUN pnpm install --frozen-lockfile

# Build all workspace projects
RUN pnpm -r build

# Bundle API with esbuild: tree-shake + minify all JS dependencies into single file
# pg is external because it has optional native bindings (libpq)
# node-pg-migrate is external because it reads SQL files at runtime
RUN cd apps/api && npx esbuild dist/index.js \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/bundle.cjs \
  --external:pg \
  --external:node-pg-migrate \
  --minify

# Copy database migrations (needed for runtime schema updates)
COPY apps/api/src/db/migrations ./apps/api/src/db/migrations

# ============ Production Stage ============
FROM node:20-alpine AS production

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Create workspace data directory with proper ownership
RUN mkdir -p /data/workspaces && chown -R appuser:nodejs /data

# Declare workspace as a volume for persistence
VOLUME /data/workspaces

WORKDIR /app

# Copy the bundled single-file application (~3-5MB)
COPY --from=builder --chown=appuser:nodejs /app/apps/api/dist/bundle.cjs ./bundle.cjs

# Copy templates directory for blank project initialization
COPY --chown=appuser:nodejs apps/api/templates ./templates

# Copy database migrations (node-pg-migrate reads these at runtime)
COPY --from=builder --chown=appuser:nodejs /app/apps/api/src/db/migrations ./migrations

# Install ONLY runtime-native modules (pg is external from bundle, node-pg-migrate is CLI-only)
# Everything else (express, socket.io, zod, ioredis, etc.) is tree-shaken into bundle.cjs
RUN npm install pg@8.11.3 node-pg-migrate@8.0.4 dotenv@16.4.0 --production

# Switch to non-root user
USER appuser

ENV NODE_ENV=production PORT=3001 WORKSPACE_BASE=/data/workspaces API_ROOT=/app MIGRATIONS_DIR=migrations
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "bundle.cjs"]
