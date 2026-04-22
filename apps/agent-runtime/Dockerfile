# Agent Runtime Dockerfile
# Build pre-requisites:
#   cd apps/agent-runtime && npm run build
# Build command:
#   docker build -f apps/agent-runtime/Dockerfile -t agenthive/agent-runtime:<tag> ./apps/agent-runtime

FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init git

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p /workspace && \
    chown -R nodejs:nodejs /workspace /app

# Copy workspace node_modules (includes @agenthive/* packages)
COPY --chown=nodejs:nodejs ../../node_modules ./node_modules
COPY --chown=nodejs:nodejs ../../package.json ./

# Copy application
COPY --chown=nodejs:nodejs dist ./dist
COPY --chown=nodejs:nodejs package.json ./

# Labels for traceability
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Agent Runtime"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
