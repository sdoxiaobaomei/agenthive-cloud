# Landing Dockerfile - Nuxt 3 SSR (Node.js)
# Build pre-requisites:
#   cd apps/landing && npm run build
# Build command:
#   docker build -f apps/landing/Dockerfile -t agenthive/landing:<tag> .

FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy pre-built Nuxt output (.output-new contains client + server)
COPY --chown=appuser:nodejs apps/landing/.output-new /app/.output

# Reinstall dependencies in container (avoids Windows junction/symlink issues)
# The node_modules from Windows host contain reparse points that break in Linux.
RUN cd /app/.output/server && \
    rm -rf node_modules && \
    npm install --omit=dev --no-audit --no-fund --progress=false

# Labels for traceability
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Landing"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

USER appuser

ENV NODE_ENV=production
ENV NITRO_PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["node", ".output/server/index.mjs"]
