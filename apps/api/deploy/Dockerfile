# syntax=docker/dockerfile:1
# API Service Dockerfile - Development / Full Build
# Suitable for environments where you want to build entirely inside Docker.
# Build: docker build -f apps/api/deploy/Dockerfile -t agenthive/api:<tag> .

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# ============ 生产阶段 ============
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Remove dev dependencies to minimize image size
RUN npm prune --omit=dev --no-audit --no-fund

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /data/workspaces && \
    chown -R nodejs:nodejs /data/workspaces /app

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
