# Landing Service - Nuxt 3 SSR with Multi-stage Build
# Builds entirely inside container to avoid host OS / Windows symlink issues.
# Build command (from repo root):
#   docker build -f apps/landing/Dockerfile -t agenthive/landing:<tag> .
#
# Expected image size: ~200-350 MB (vs 1GB+ before)

# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

# Copy entire monorepo (node_modules excluded by root .dockerignore)
COPY . .

# Inject public API base (build-time env for Nuxt runtimeConfig.public)
ARG NUXT_PUBLIC_API_BASE=/api
ENV NUXT_PUBLIC_API_BASE=${NUXT_PUBLIC_API_BASE}

# Install dependencies and build
RUN pnpm install --frozen-lockfile
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

# Install server runtime dependencies (package.json is already prod-only)
# Using pnpm instead of npm to avoid Alpine/musl peer-dep resolution bugs.
RUN cd /app/.output/server && \
    npm install -g pnpm@9 && \
    pnpm install --prod --reporter=silent

USER appuser

ENV NODE_ENV=production
ENV NITRO_PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", ".output/server/index.mjs"]
