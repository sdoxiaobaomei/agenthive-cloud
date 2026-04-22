# API Dockerfile - Production Optimized (npm workspaces)
# Build pre-requisites:
#   cd apps/api && npm run build
# Build command:
#   docker build -f apps/api/Dockerfile -t agenthive/api:<tag> .

FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy workspace node_modules (includes @agenthive/* packages)
COPY --chown=appuser:nodejs node_modules ./node_modules
COPY --chown=appuser:nodejs package.json ./

# Dereference @agenthive workspace symlinks (Windows symlinks break in Linux containers)
RUN rm -rf ./node_modules/@agenthive/* && \
    mkdir -p ./node_modules/@agenthive/observability ./node_modules/@agenthive/agent-runtime

COPY --chown=appuser:nodejs packages/observability/package.json ./node_modules/@agenthive/observability/
COPY --chown=appuser:nodejs packages/observability/dist ./node_modules/@agenthive/observability/dist

COPY --chown=appuser:nodejs apps/agent-runtime/package.json ./node_modules/@agenthive/agent-runtime/
COPY --chown=appuser:nodejs apps/agent-runtime/dist ./node_modules/@agenthive/agent-runtime/dist

# Copy API application
COPY --chown=appuser:nodejs apps/api/dist ./dist
COPY --chown=appuser:nodejs apps/api/package.json ./

# Labels for traceability
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive API"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

# Switch to non-root user
USER appuser

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
