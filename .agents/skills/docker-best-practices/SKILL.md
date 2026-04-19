# Docker Best Practices

> Official Docker best practices for building production-ready container images.
> Source: https://docs.docker.com/build/building/best-practices/

---

## Overview

This skill provides official Docker best practices for:
- Multi-stage builds to reduce image size
- BuildKit cache optimization
- Security hardening (non-root users)
- Image optimization techniques
- Dockerfile writing guidelines

---

## 1. Multi-Stage Builds (MUST USE)

### Why
- Reduces final image size by 50-90%
- Separates build dependencies from runtime
- Improves security by excluding build tools

### Template

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Build dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false

# Stage 2: Build application
FROM deps AS builder
COPY . .
RUN npm run build

# Stage 3: Production dependencies
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

# Stage 4: Final production image
FROM node:20-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy only necessary files from previous stages
COPY --from=prod-deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --chown=appuser:nodejs package.json ./

# Switch to non-root user
USER appuser

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Key Points
- Use `AS` to name stages
- Use `COPY --from` to copy between stages
- Final stage should be minimal

---

## 2. BuildKit Cache Optimization

### Cache Mounts

```dockerfile
# Cache npm packages
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Cache apt packages
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && apt-get install -y python3
```

### Bind Mounts (for source code)

```dockerfile
# Mount source code read-only
RUN --mount=type=bind,source=.,target=/app,rw \
    npm run build
```

### Benefits
- Faster rebuilds
- Persistent caching across builds
- Reduced bandwidth usage

---

## 3. Security Best Practices

### Non-Root User (REQUIRED)

```dockerfile
# Create user and group
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set ownership
COPY --chown=appuser:appgroup . .

# Switch user
USER appuser
```

### Minimal Base Images

```dockerfile
# Good: Alpine (small)
FROM node:20-alpine

# Better: Distroless (smaller, more secure)
FROM gcr.io/distroless/nodejs20-debian12

# Avoid: Full Ubuntu (large attack surface)
FROM ubuntu:22.04
```

### Read-Only Root Filesystem

```dockerfile
# Run with read-only root
# docker run --read-only myimage

# Or in docker-compose
services:
  app:
    image: myimage
    read_only: true
    tmpfs:
      - /tmp
      - /var/cache
```

---

## 4. Image Size Optimization

### Layer Ordering

```dockerfile
# Put least frequently changed layers first
FROM node:20-alpine

# 1. System dependencies (rarely changes)
RUN apk add --no-cache curl

# 2. App dependencies (changes with package.json)
COPY package*.json ./
RUN npm ci --production

# 3. Application code (changes frequently)
COPY . .
```

### Combine RUN Commands

```dockerfile
# Good: Fewer layers
RUN apt-get update && \
    apt-get install -y curl vim && \
    rm -rf /var/lib/apt/lists/*

# Bad: More layers
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y vim
RUN rm -rf /var/lib/apt/lists/*
```

### Remove Unnecessary Files

```dockerfile
# Remove package manager cache
RUN npm ci && npm cache clean --force

# Remove build artifacts
RUN rm -rf /tmp/* /var/cache/*
```

---

## 5. Dockerfile Writing Guidelines

### Use .dockerignore

```gitignore
# Node
node_modules
npm-debug.log

# Git
.git
.gitignore

# IDE
.vscode
.idea

# Build outputs
dist
.nuxt
.output
```

### Label Your Images

```dockerfile
LABEL maintainer="team@example.com"
LABEL org.opencontainers.image.title="My App"
LABEL org.opencontainers.image.description="Application description"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/org/repo"
```

### Use Specific Versions

```dockerfile
# Good: Specific version
FROM node:20.11.0-alpine3.19

# Bad: Latest (unpredictable)
FROM node:latest
```

### Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
```

---

## 6. Language-Specific Examples

### Node.js

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json ./
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "dist/index.js"]
```

### Python

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.11-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY . .
RUN chown -R appuser:appuser /app
ENV PATH=/home/appuser/.local/bin:$PATH
USER appuser
EXPOSE 8000
CMD ["python", "app.py"]
```

---

## 7. Build Commands

### Build with BuildKit

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build
docker build -t myapp:latest .

# Build specific stage
docker build --target builder -t myapp:builder .
```

### Build with Cache

```bash
# Use cache from previous builds
docker build \
  --cache-from myapp:builder \
  -t myapp:latest .
```

### Multi-platform Builds

```bash
# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myapp:latest \
  --push .
```

---

## 8. Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|---------|------|
| Use `latest` tag | Use specific versions |
| Run as root | Use non-root user |
| Include dev dependencies in production | Use multi-stage builds |
| Store secrets in images | Use environment variables |
| Use ADD for remote URLs | Use curl/wget with verification |
| Ignore .dockerignore | Always use .dockerignore |

---

## References

- [Docker Best Practices](https://docs.docker.com/build/building/best-practices/)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [BuildKit](https://docs.docker.com/build/buildkit/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)

---

## Version

Last Updated: 2026-04-07
Based on: Docker Documentation (docs.docker.com)
