# syntax=docker/dockerfile:1
# Landing Service - Nuxt 3 SSR with Multi-stage Build
# Optimized for Docker layer caching and BuildKit cache mounts.
#
# Build command (from repo root):
#   docker build -f apps/landing/Dockerfile -t agenthive/landing:<tag> .
#
# Expected image size: ~200-350 MB (vs 1GB+ before)
# Expected incremental build time: ~60-90s (vs ~280s before)
#   when only source code changes (dependencies cached)

# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

# Enable Corepack for pnpm (faster & cleaner than npm install -g)
RUN corepack enable && corepack prepare pnpm@9 --activate

# --- Layer 1: Workspace manifests (cached until any package.json or lockfile changes) ---
# Copy root workspace definition and lockfile FIRST for optimal Docker layer caching.
# This ensures 'pnpm install' is cached independently of source code changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy ALL workspace package.json files required by pnpm to resolve the monorepo graph.
# Only these ~8 small files invalidate the dependency layer; source code does NOT.
COPY apps/agent-runtime/package.json apps/agent-runtime/
COPY apps/api/package.json apps/api/
COPY apps/landing/package.json apps/landing/
COPY packages/cli/package.json packages/cli/
COPY packages/observability/package.json packages/observability/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/workflow-engine/package.json packages/workflow-engine/

# --- Layer 2: Dependency installation (cached + persistent pnpm store) ---
# --mount=type=cache keeps the pnpm store on the host across builds,
# so 1200+ packages are downloaded only ONCE, not every build.
# --ignore-scripts skips lifecycle hooks (e.g. nuxt prepare) until source is present.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# --- Layer 3: Source code (cached until source files change) ---
COPY . .

# --- Layer 4: Lifecycle scripts (fast: deps already installed) ---
# Run postinstall/prepare scripts now that source code is available.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm rebuild

# --- Layer 5: Build-time environment ---
ARG NUXT_PUBLIC_API_BASE=/api
ENV NUXT_PUBLIC_API_BASE=${NUXT_PUBLIC_API_BASE}

# --- Layer 6: Build workspace packages and landing app ---
RUN pnpm --filter=@agenthive/types build
RUN pnpm --filter=agenthive-landing build

# ============ 生产阶段 ============
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for signal handling and wget for healthcheck
RUN apk add --no-cache dumb-init wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy pre-built Nuxt output
COPY --from=builder --chown=appuser:nodejs /app/apps/landing/.output ./.output

# Use corepack for pnpm (lighter than npm install -g)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install server runtime dependencies (package.json is already prod-only)
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    cd /app/.output/server && \
    pnpm install --prod --reporter=silent

USER appuser

ENV NODE_ENV=production
ENV NITRO_PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", ".output/server/index.mjs"]
