# Landing Dockerfile - Nuxt 3 SSR (Node.js)

# ============================================
# Production (Node.js)
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy pre-built output
COPY --chown=appuser:nodejs .output-new /app/.output

# Fix symlinks: reinstall dependencies in container
RUN cd /app/.output/server && \
    rm -rf node_modules && \
    npm install --production

USER appuser

ENV NODE_ENV=production
ENV NITRO_PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["node", ".output/server/index.mjs"]
