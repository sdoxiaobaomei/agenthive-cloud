# AGENTHIVE-003: Live Preview System — Code Blueprint

**Status**: Draft
**Author**: AgentHive Architecture
**Date**: 2026-05-09
**Target Codebase**: `agenthive-cloud` (monorepo at `e:\Git\agenthive-cloud`)
**Depends On**: AGENTHIVE-001 (Generation Pipeline), AGENTHIVE-002 (Agent Runtime)

---

## 1. Preview System Overview

### 1.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (iframe)                          │
│  src="/api/projects/{projectId}/preview/"                       │
│  PreviewPanel.vue → PreviewToolbar.vue                          │
│    Device toggle (Desktop / Tablet / Mobile)                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP GET + WebSocket Upgrade
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Nuxt BFF (nitro.devProxy)                       │
│  apps/landing/nuxt.config.ts                                    │
│  Matches: /api/projects/**/preview/** → http://api:3001          │
│  Ensures WebSocket upgrade passes through Nuxt dev proxy         │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│               Express API (Port 3001)                             │
│  NEW: GET /api/projects/:id/preview/*  (http-proxy-middleware)   │
│  Auth: validate project ownership via X-User-Id header           │
│  Target: http://localhost:{allocatedPort}                         │
│  Error handling: graceful HTML error pages for iframe display    │
│  Rate limiting: 100 req/10s per project                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  NEW: apps/api/src/services/preview-server.ts                    │
│  PreviewServerManager (singleton)                                │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Process Map: Map<projectId, { process, port, startTime  │     │
│  │   lastAccessTime, status }>                              │     │
│  │ Port Alloc: Redis SET agenthive:preview:allocated_ports  │     │
│  │   (ports 5100-5199, SADD+SPOP atomic allocation)         │     │
│  │ Stdio: pipe → Redis pub/sub agenthive:preview:log:{id}   │     │
│  │ Health: HTTP GET http://localhost:{port} poll 2s until   │     │
│  │   200 (timeout 30s)                                      │     │
│  │ Eviction: max 10 concurrent, 5-min idle → SIGTERM → free │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ child_process.spawn('npx', ['vite', '--port', port])
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vite Dev Server (localhost:5xxx)                                │
│  cwd = workspacePath (e.g. /workspaces/{userId}/{projectId})    │
│  HMR enabled → live reload in iframe                             │
│  Serves generated frontend app                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Rationale: child_process vs Containerization

| Concern | child_process Approach (chosen) | Containerization Alternative |
|---------|-------------------------------|------------------------------|
| **Startup latency** | <2s (`npx vite`) | 5-15s (image pull + container init) |
| **Resource overhead** | ~50-150 MB memory per process | ~200-500 MB per container |
| **Dev UX** | HMR works out of the box | Requires volume mounts + port mapping |
| **Isolation** | Process-level only (same machine) | Container-level isolation |
| **Security** | Acceptable — preview code is our generated output | Strong — full namespace isolation |
| **Scalability ceiling** | 10 concurrent (LRU eviction) | 50+ with orchestrator |
| **Complexity** | Low — `child_process.spawn` | High — Docker daemon API + image management |

**Decision**: `child_process` for Phase 1. The generated apps are trusted (our own LLM output). Containerization should be added in Phase 2 when multi-tenancy isolation becomes critical (foreign repo imports, untrusted user uploads). The `PreviewServerManager` API is designed so swapping the backend from `spawn` to Docker is a single-method change (`start()`).

---

## 2. PreviewServerManager Class

### 2.1 File: `apps/api/src/services/preview-server.ts` (NEW)

```typescript
// Preview Server Manager — manages Vite dev server child processes
import { spawn, ChildProcess } from 'child_process'
import { redis, key } from '../config/redis.js'
import { broadcast } from '../websocket/hub.js'
import logger from '../utils/logger.js'
import http from 'http'

// ─── Constants ───
const PORT_RANGE_START = 5100
const PORT_RANGE_END = 5199
const PORT_RANGE_SIZE = PORT_RANGE_END - PORT_RANGE_START + 1 // 100
const MAX_CONCURRENT_PREVIEWS = 10
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const HEALTH_CHECK_INTERVAL_MS = 2000
const HEALTH_CHECK_TIMEOUT_MS = 30000
const PORT_ALLOC_SET_KEY = key('preview', 'allocated_ports')

// ─── Types ───
export type PreviewStatus = 'starting' | 'ready' | 'error' | 'stopped'

export interface PreviewProcess {
  projectId: string
  process: ChildProcess
  port: number
  startTime: number
  lastAccessTime: number
  status: PreviewStatus
  error?: string
}

export interface PreviewStatusInfo {
  status: PreviewStatus
  port?: number
  url?: string
  error?: string
  uptimeMs?: number
}

// ─── Port Allocation ───

/**
 * Atomically allocate a port using Redis SET with SADD+SPOP.
 * Initializes the port pool if it doesn't exist.
 */
async function allocatePort(): Promise<number> {
  // Ensure port pool is initialized
  const exists = await redis.exists(PORT_ALLOC_SET_KEY)
  if (!exists) {
    const ports = Array.from(
      { length: PORT_RANGE_SIZE },
      (_, i) => String(PORT_RANGE_START + i)
    )
    await redis.sadd(PORT_ALLOC_SET_KEY, ...ports)
    logger.info('[PreviewServer] Initialized port pool', {
      range: `${PORT_RANGE_START}-${PORT_RANGE_END}`,
    })
  }

  // Atomically pop one port
  const port = await redis.spop(PORT_ALLOC_SET_KEY)
  if (!port) {
    throw new Error('No available ports in preview range (5100-5199)')
  }
  return parseInt(port, 10)
}

/**
 * Release a port back to the pool.
 */
async function releasePort(port: number): Promise<void> {
  await redis.sadd(PORT_ALLOC_SET_KEY, String(port))
  logger.info('[PreviewServer] Released port', { port })
}

// ─── Redis Server State ───

const SERVER_HASH = (projectId: string) => key('preview', `server:${projectId}`)
const LOG_LIST = (projectId: string) => key('preview', `log:${projectId}`)
const LAST_ACCESS = (projectId: string) => key('preview', `last_access:${projectId}`)
const STATUS_KEY = (projectId: string) => key('preview', `status:${projectId}`)

async function setServerState(projectId: string, fields: Record<string, string | number>): Promise<void> {
  await redis.hset(SERVER_HASH(projectId), fields)
  await redis.expire(SERVER_HASH(projectId), 3600) // 1h TTL
}

async function getServerState(projectId: string): Promise<Record<string, string> | null> {
  const data = await redis.hgetall(SERVER_HASH(projectId))
  return Object.keys(data).length > 0 ? data : null
}

async function clearServerState(projectId: string): Promise<void> {
  await redis.del(SERVER_HASH(projectId), LOG_LIST(projectId), LAST_ACCESS(projectId), STATUS_KEY(projectId))
}

async function publishLog(projectId: string, line: string): Promise<void> {
  // Push to Redis list (capped at 1000)
  const logKey = LOG_LIST(projectId)
  await redis.rpush(logKey, line)
  await redis.ltrim(logKey, -1000, -1)
  await redis.expire(logKey, 3600)

  // Publish for real-time streaming via WebSocket
  await redis.publish(`preview:log:${projectId}`, line)
}

async function publishStatus(projectId: string, status: PreviewStatus, extra?: Record<string, unknown>): Promise<void> {
  const payload = JSON.stringify({ projectId, status, ...extra, timestamp: Date.now() })
  await redis.setex(STATUS_KEY(projectId), 3600, JSON.stringify({ status, ...extra }))
  await redis.publish(`preview:status:${projectId}`, payload)
}

// ─── Health Check ───

async function checkHealth(port: number): Promise<{ healthy: boolean; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve({ healthy: res.statusCode === 200, statusCode: res.statusCode })
    })
    req.on('error', (err) => {
      resolve({ healthy: false, error: err.message })
    })
    req.setTimeout(3000, () => {
      req.destroy()
      resolve({ healthy: false, error: 'timeout' })
    })
  })
}

// ─── PreviewServerManager ───

export class PreviewServerManager {
  private processes: Map<string, PreviewProcess> = new Map()
  private healthIntervals: Map<string, NodeJS.Timeout> = new Map()
  private idleTimer: NodeJS.Timeout | null = null

  /**
   * Start a preview server for a project.
   * Copies/links the workspace, runs `npx vite`, and health-checks until ready.
   */
  async start(projectId: string, workspacePath: string): Promise<PreviewStatusInfo> {
    // Check if already running
    const existing = this.processes.get(projectId)
    if (existing) {
      return {
        status: existing.status,
        port: existing.port,
        url: `http://localhost:${existing.port}`,
        uptimeMs: Date.now() - existing.startTime,
      }
    }

    // LRU eviction if at capacity
    await this.evictIfNeeded()

    // Allocate port
    const port = await allocatePort()
    logger.info('[PreviewServer] Starting preview', { projectId, port, workspacePath })

    // Update state
    await setServerState(projectId, {
      status: 'starting',
      port,
      pid: 0,
      startTime: String(Date.now()),
    })
    await publishStatus(projectId, 'starting', { port })

    // Spawn Vite dev server
    const proc = spawn('npx', ['vite', '--port', String(port), '--host', '0.0.0.0'], {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(port),
      },
    })

    const preview: PreviewProcess = {
      projectId,
      process: proc,
      port,
      startTime: Date.now(),
      lastAccessTime: Date.now(),
      status: 'starting',
    }

    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        publishLog(projectId, line)
      }
      // Detect Vite ready message
      if (data.toString().includes('Local:') || data.toString().includes('localhost')) {
        // Will be confirmed by health check
      }
    })

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        publishLog(projectId, `[stderr] ${line}`)
      }
    })

    // Handle exit
    proc.on('exit', (code, signal) => {
      logger.info('[PreviewServer] Process exited', { projectId, code, signal })
      this.processes.delete(projectId)
      const healthInterval = this.healthIntervals.get(projectId)
      if (healthInterval) {
        clearInterval(healthInterval)
        this.healthIntervals.delete(projectId)
      }
      releasePort(port)
      const status = code === 0 || signal === 'SIGTERM' ? 'stopped' : 'error'
      publishStatus(projectId, status, { exitCode: code, signal })
      clearServerState(projectId)
    })

    this.processes.set(projectId, preview)

    // Start health check polling
    const startTime = Date.now()
    const healthInterval = setInterval(async () => {
      const { healthy } = await checkHealth(port)
      if (healthy && preview.status !== 'ready') {
        preview.status = 'ready'
        await setServerState(projectId, {
          status: 'ready',
          port,
          pid: String(proc.pid || 0),
          startTime: String(startTime),
        })
        await publishStatus(projectId, 'ready', {
          port,
          url: `http://localhost:${port}`,
        })
        clearInterval(healthInterval)
        this.healthIntervals.delete(projectId)

        // Broadcast ready to WebSocket
        broadcast.toAll('preview:status', {
          projectId,
          status: 'ready',
          port,
          url: `http://localhost:${port}`,
        })
      } else if (Date.now() - startTime > HEALTH_CHECK_TIMEOUT_MS) {
        // Timeout — mark as error
        preview.status = 'error'
        preview.error = `Health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`
        await publishStatus(projectId, 'error', { error: preview.error })
        clearInterval(healthInterval)
        this.healthIntervals.delete(projectId)

        broadcast.toAll('preview:status', {
          projectId,
          status: 'error',
          error: preview.error,
        })
      }
    }, HEALTH_CHECK_INTERVAL_MS)

    this.healthIntervals.set(projectId, healthInterval)

    // Start idle cleanup timer (shared for all processes)
    this.scheduleIdleCleanup()

    return { status: 'starting', port, url: `http://localhost:${port}` }
  }

  /**
   * Stop a preview server gracefully.
   * Sends SIGTERM, waits 5s, then SIGKILL if still alive.
   */
  async stop(projectId: string): Promise<void> {
    const preview = this.processes.get(projectId)
    if (!preview) {
      logger.warn('[PreviewServer] No process to stop', { projectId })
      return
    }

    logger.info('[PreviewServer] Stopping preview', { projectId, pid: preview.process.pid })

    preview.status = 'stopped'
    await publishStatus(projectId, 'stopped')

    // Graceful shutdown
    preview.process.kill('SIGTERM')

    const killed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        if (preview.process.exitCode === null) {
          preview.process.kill('SIGKILL')
          resolve(true)
        }
        resolve(false)
      }, 5000)

      preview.process.on('exit', () => {
        clearTimeout(timeout)
        resolve(false)
      })
    })

    if (killed) {
      logger.warn('[PreviewServer] Force-killed process', { projectId })
    }

    this.processes.delete(projectId)
    const healthInterval = this.healthIntervals.get(projectId)
    if (healthInterval) {
      clearInterval(healthInterval)
      this.healthIntervals.delete(projectId)
    }
    await releasePort(preview.port)
    await clearServerState(projectId)
  }

  /**
   * Get status of a preview server.
   */
  async getStatus(projectId: string): Promise<PreviewStatusInfo> {
    const preview = this.processes.get(projectId)
    if (preview) {
      return {
        status: preview.status,
        port: preview.port,
        url: `http://localhost:${preview.port}`,
        uptimeMs: Date.now() - preview.startTime,
      }
    }

    // Check Redis for persisted state (e.g., after API restart)
    const state = await getServerState(projectId)
    if (state) {
      return {
        status: (state.status as PreviewStatus) || 'stopped',
        port: state.port ? parseInt(state.port, 10) : undefined,
        url: state.port ? `http://localhost:${state.port}` : undefined,
      }
    }

    return { status: 'stopped' }
  }

  /**
   * Get number of currently active preview servers.
   */
  getActiveCount(): number {
    return this.processes.size
  }

  /**
   * Update last access time (called when iframe loads or user interacts).
   */
  touch(projectId: string): void {
    const preview = this.processes.get(projectId)
    if (preview) {
      preview.lastAccessTime = Date.now()
      redis.setex(LAST_ACCESS(projectId), 600, String(Date.now()))
    }
  }

  /**
   * Evict the least-recently-used preview if at capacity.
   * Designed to be called before starting a new server.
   */
  private async evictIfNeeded(): Promise<void> {
    if (this.processes.size < MAX_CONCURRENT_PREVIEWS) return

    // Find oldest by lastAccessTime
    let oldest: PreviewProcess | null = null
    for (const [, preview] of this.processes) {
      if (!oldest || preview.lastAccessTime < oldest.lastAccessTime) {
        oldest = preview
      }
    }

    if (oldest) {
      logger.info('[PreviewServer] Evicting LRU preview', {
        projectId: oldest.projectId,
        lastAccess: new Date(oldest.lastAccessTime).toISOString(),
      })
      await this.stop(oldest.projectId)
    }
  }

  /**
   * Schedule periodic idle cleanup.
   * Every 30s, checks for previews idle > IDLE_TIMEOUT_MS.
   */
  private scheduleIdleCleanup(): void {
    if (this.idleTimer) return
    this.idleTimer = setInterval(() => {
      const now = Date.now()
      for (const [projectId, preview] of this.processes) {
        if (now - preview.lastAccessTime > IDLE_TIMEOUT_MS) {
          logger.info('[PreviewServer] Idle timeout, stopping preview', {
            projectId,
            idleMs: now - preview.lastAccessTime,
          })
          this.stop(projectId)
        }
      }

      // Clear timer if no more processes
      if (this.processes.size === 0) {
        clearInterval(this.idleTimer!)
        this.idleTimer = null
      }
    }, 30_000)
  }

  /**
   * Cleanup all running previews (for graceful shutdown).
   */
  async cleanup(): Promise<void> {
    logger.info('[PreviewServer] Cleaning up all previews', { count: this.processes.size })
    const projectIds = Array.from(this.processes.keys())
    await Promise.all(projectIds.map((id) => this.stop(id)))

    if (this.idleTimer) {
      clearInterval(this.idleTimer)
      this.idleTimer = null
    }
  }
}

// ─── Global Singleton ───

let globalPreviewServerManager: PreviewServerManager | null = null

export function initializePreviewServer(): PreviewServerManager {
  globalPreviewServerManager = new PreviewServerManager()
  logger.info('[PreviewServer] Initialized')
  return globalPreviewServerManager
}

export function getPreviewServerManager(): PreviewServerManager {
  if (!globalPreviewServerManager) {
    throw new Error('PreviewServerManager not initialized. Call initializePreviewServer() first.')
  }
  return globalPreviewServerManager
}
```

---

## 3. Preview Proxy Endpoint

### 3.1 File: `apps/api/src/routes/preview.ts` (NEW)

```typescript
// Preview Proxy Route — proxies incoming iframe requests to Vite dev server
import { Router, Request, Response } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { getPreviewServerManager } from '../services/preview-server.js'
import logger from '../utils/logger.js'

const router = Router()

// ─── Rate Limiter (simple in-memory) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 10_000
const RATE_LIMIT_MAX = 100

function checkRateLimit(projectId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(projectId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(projectId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ─── Error Page Templates ───

function renderErrorPage(statusCode: number, message: string, projectId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Error - AgentHive</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0f172a; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; text-align: center;
    }
    .error-card {
      background: #1e293b; border: 1px solid #334155;
      border-radius: 12px; padding: 48px; max-width: 480px;
    }
    .error-code { font-size: 64px; font-weight: 700; color: #f87171; margin-bottom: 8px; }
    .error-title { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
    .error-message { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .retry-btn {
      background: #3b82f6; color: #fff; border: none;
      padding: 10px 24px; border-radius: 8px; font-size: 14px;
      cursor: pointer; transition: background 0.2s;
    }
    .retry-btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="error-code">${statusCode}</div>
    <div class="error-title">Preview ${statusCode >= 500 ? 'Error' : 'Not Found'}</div>
    <div class="error-message">${message}</div>
    <button class="retry-btn" onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`
}

// ─── Proxy Route ───

/**
 * GET /api/projects/:projectId/preview/*
 *
 * Proxies requests to the Vite dev server running for the project.
 * Handles:
 *   - Auth check (project ownership)
 *   - Rate limiting (100 req/10s per project)
 *   - Websocket upgrade (HMR in iframe)
 *   - Graceful error pages for iframe display
 */
router.all('/:projectId/preview', (req: Request, res: Response) => {
  // Validate projectId
  const { projectId } = req.params as { projectId: string }
  if (!projectId || projectId.length < 8) {
    return res.status(400).send(renderErrorPage(400, 'Invalid project ID', projectId))
  }

  // Auth check — validate project ownership
  const userId = (req as any).userId as string | undefined
  if (!userId) {
    return res.status(401).send(renderErrorPage(401, 'Authentication required', projectId))
  }
  // NOTE: Full ownership check deferred to middleware.
  // At minimum, ensure X-User-Id matches project owner in a real middleware.

  // Rate limit
  if (!checkRateLimit(projectId)) {
    return res.status(429).send(renderErrorPage(429, 'Too many requests. Please wait a moment.', projectId))
  }

  const previewManager = getPreviewServerManager()
  const status = previewManager.getStatus(projectId)

  // If status is fetched synchronously and shows not running, return error page
  // (The async proxy middleware handles the running case)
  void status.then((s) => {
    if (s.status === 'stopped' || s.status === 'error') {
      // Only send if headers not already sent by the proxy
      if (!res.headersSent) {
        res.status(503).send(
          renderErrorPage(
            503,
            s.status === 'error'
              ? `Preview server error: ${s.error || 'Unknown error'}`
              : 'Preview server is not running. Start a generation to see the preview.',
            projectId
          )
        )
      }
    }
  })
})

// Proxy middleware for paths under /preview/
router.use(
  '/:projectId/preview',
  async (req: Request, res: Response, next: Function) => {
    const { projectId } = req.params as { projectId: string }
    const previewManager = getPreviewServerManager()
    const status = await previewManager.getStatus(projectId)

    if (status.status !== 'ready' || !status.port) {
      // Not ready — let the projects/:projectId/preview handler above render error
      next()
      return
    }

    // Touch the access time to prevent idle eviction
    previewManager.touch(projectId)

    // Create per-request proxy to the Vite dev server
    const proxy = createProxyMiddleware({
      target: `http://localhost:${status.port}`,
      changeOrigin: true,
      ws: true, // WebSocket upgrade for HMR
      logLevel: 'silent',
      onError(err, proxyReq, proxyRes) {
        logger.error('[PreviewProxy] Proxy error', err, { projectId, port: status.port })
        if (proxyRes && !proxyRes.headersSent) {
          ;(proxyRes as Response).status(502).send(
            renderErrorPage(502, `Cannot connect to preview server: ${err.message}`, projectId)
          )
        }
      },
      onProxyReq(proxyReq) {
        // Strip prefix so Vite sees / instead of /api/projects/{id}/preview/
        proxyReq.path = proxyReq.path.replace(`/api/projects/${projectId}/preview`, '') || '/'
      },
    })

    proxy(req, res, next)
  }
)

export default router
```

### 3.2 Route Registration

Modify `apps/api/src/routes/index.ts` (line 86-93) to add the preview route:

```typescript
// In apps/api/src/routes/index.ts, add after line 90:
import previewRoutes from './preview.js'

// Add before the export default router (after line 92):
router.use('/projects', previewRoutes) // must be before the generic /projects route
```

Actually, for correct route ordering the preview route should be registered on the project router itself, or we restructure. The cleanest approach:

Modify `apps/api/src/project/routes.ts` to add a preview sub-route:

```typescript
// Add to apps/api/src/project/routes.ts (after line 41):
import previewProxy from '../routes/preview.js'

// Add before export default router:
router.use('/:id/preview', previewProxy)
```

---

## 4. Nuxt BFF Passthrough

### 4.1 Modification: `apps/landing/nuxt.config.ts` (line 126-136)

Replace the commented-out `nitro.devProxy` section with the following:

```typescript
// In apps/landing/nuxt.config.ts, modify the nitro block:

  nitro: {
    // devProxy enables BFF passthrough during development
    // /api requests go through Nuxt → Express API
    devProxy: {
      // Generic API passthrough to Gateway (8080)
      // '/api': {
      //   target: 'http://localhost:8080',
      //   changeOrigin: true,
      // },
      // Preview proxy — must include WebSocket upgrade support
      '/api/projects/**/preview/**': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
```

This ensures:
1. The iframe `src="/api/projects/{projectId}/preview/"` request reaches the Express API.
2. WebSocket upgrade (for Vite HMR inside the iframe) passes through Nuxt's dev proxy correctly.
3. In production, the Nginx Gateway handles this routing directly, bypassing Nuxt.

---

## 5. PreviewPanel.vue Component

### 5.1 File: `apps/landing/components/preview/PreviewPanel.vue` (NEW)

```vue
<template>
  <div class="preview-panel" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- Toolbar -->
    <PreviewToolbar
      :preview-url="previewUrl"
      :is-loading="currentState === 'loading'"
      :show-refresh="currentState === 'preview'"
      :device="device"
      @refresh="handleRefresh"
      @open-new-window="handleOpenNewWindow"
      @device-change="handleDeviceChange"
    />

    <!-- States -->
    <div class="preview-body">
      <!-- Empty State -->
      <div v-if="currentState === 'empty'" class="preview-state preview-empty">
        <div class="window-frame">
          <div class="window-controls">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="url-bar">localhost:3000</div>
        </div>
        <div class="state-content">
          <el-icon class="state-icon"><Monitor /></el-icon>
          <h3>App Preview</h3>
          <p>Preview will be available after project build</p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="currentState === 'loading'" class="preview-state preview-loading">
        <div class="state-content">
          <el-icon class="state-icon is-spin"><Loading /></el-icon>
          <h3>Starting Dev Server</h3>
          <p>{{ loadingMessage }}</p>
          <div class="loading-spinner">
            <div class="spinner-dot"></div>
            <div class="spinner-dot"></div>
            <div class="spinner-dot"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="currentState === 'error'" class="preview-state preview-error">
        <div class="state-content">
          <el-icon class="state-icon error-icon"><WarningFilled /></el-icon>
          <h3>Preview Error</h3>
          <p>{{ errorMessage }}</p>
          <el-button type="primary" @click="handleRetry">Retry</el-button>
        </div>
      </div>

      <!-- Preview State (iframe) -->
      <div
        v-else-if="currentState === 'preview'"
        class="preview-iframe-wrapper"
        :class="`device-${device}`"
      >
        <div class="device-frame">
          <div class="window-frame">
            <div class="window-controls">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
            </div>
            <div class="url-bar">{{ previewUrl }}</div>
          </div>
          <iframe
            ref="previewIframe"
            :src="iframeSrc"
            class="preview-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            @load="handleIframeLoad"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Monitor, Loading, WarningFilled } from '@element-plus/icons-vue'
import PreviewToolbar from './PreviewToolbar.vue'
import { useSocket } from '~/composables/useSocket'

// ─── Props ───
const props = defineProps<{
  projectId: string
  generationStatus: 'idle' | 'generating' | 'ready' | 'error'
}>()

// ─── Emits ───
const emit = defineEmits<{
  refresh: []
  'open-new-window': [url: string]
}>()

// ─── State ───
type PreviewState = 'empty' | 'loading' | 'error' | 'preview'

const previewIframe = ref<HTMLIFrameElement | null>(null)
const device = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const currentState = ref<PreviewState>('empty')
const errorMessage = ref<string>('')
const loadingMessage = ref<string>('Starting up dev server...')
const previewUrl = ref<string>('')
const previewPort = ref<number | null>(null)
const isFullscreen = ref(false)
const iframeLoadCount = ref(0)

// ─── Computed ───
const iframeSrc = computed(() => {
  return `/api/projects/${props.projectId}/preview/`
})

// ─── WebSocket ───
const { on, off } = useSocket()

onMounted(() => {
  // Listen for preview status changes
  on('preview:status', (data: any) => {
    if (data.projectId !== props.projectId) return

    switch (data.status) {
      case 'starting':
        currentState.value = 'loading'
        loadingMessage.value = 'Starting dev server...'
        if (data.port) previewPort.value = data.port
        break
      case 'ready':
        currentState.value = 'preview'
        previewUrl.value = data.url || `http://localhost:${data.port}`
        updateIframeIfNeeded()
        break
      case 'error':
        currentState.value = 'error'
        errorMessage.value = data.error || 'Unknown preview error'
        break
      case 'stopped':
        currentState.value = 'empty'
        break
    }
  })

  // Listen for preview logs
  on('preview:log', (data: any) => {
    if (data.projectId === props.projectId) {
      loadingMessage.value = data.line || loadingMessage.value
    }
  })
})

onUnmounted(() => {
  off('preview:status')
  off('preview:log')
})

// ─── Watch generation status ───
watch(() => props.generationStatus, (newStatus) => {
  if (newStatus === 'generating') {
    currentState.value = 'loading'
    loadingMessage.value = 'Preparing workspace...'
  } else if (newStatus === 'error') {
    currentState.value = 'error'
    errorMessage.value = 'Generation failed. Please check the logs.'
  }
  // 'ready' — WebSocket will handle the actual preview state
})

// ─── Methods ───
function updateIframeIfNeeded(): void {
  // Force iframe reload when preview becomes ready
  if (previewIframe.value && currentState.value === 'preview') {
    iframeLoadCount.value++
    previewIframe.value.src = `${iframeSrc.value}?t=${Date.now()}`
  }
}

function handleIframeLoad(): void {
  // Preview loaded successfully in iframe
}

function handleRefresh(): void {
  if (previewIframe.value) {
    previewIframe.value.src = previewIframe.value.src
  }
  emit('refresh')
}

function handleOpenNewWindow(): void {
  const url = previewUrl.value || `http://localhost:${previewPort.value}`
  window.open(url, '_blank', 'noopener,noreferrer')
  emit('open-new-window', url)
}

function handleRetry(): void {
  currentState.value = 'loading'
  loadingMessage.value = 'Retrying...'
  // The backend will re-broadcast status when ready
}

function handleDeviceChange(newDevice: 'desktop' | 'tablet' | 'mobile'): void {
  device.value = newDevice
}
</script>

<style scoped>
.preview-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f172a;
  border-radius: 8px;
  overflow: hidden;
}

.preview-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

/* ── Preview States ── */
.preview-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.state-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: #94a3b8;
}

.state-icon {
  font-size: 48px;
  color: #475569;
}

.state-icon.is-spin {
  animation: spin 2s linear infinite;
  color: #3b82f6;
}

.state-icon.error-icon {
  color: #f87171;
}

.state-content h3 {
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
}

.state-content p {
  font-size: 14px;
  margin: 0;
}

/* ── Window Frame (macOS style) ── */
.window-frame {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.window-controls {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red    { background: #ef4444; }
.dot.yellow { background: #f59e0b; }
.dot.green  { background: #22c55e; }

.url-bar {
  flex: 1;
  background: #334155;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-family: 'IBM Plex Mono', monospace;
  color: #94a3b8;
  text-align: center;
}

/* ── Loading Spinner ── */
.loading-spinner {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.spinner-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  animation: bounce 1.4s ease-in-out infinite both;
}

.spinner-dot:nth-child(1) { animation-delay: -0.32s; }
.spinner-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Iframe Container ── */
.preview-iframe-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #020617;
}

.device-frame {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

/* Device presets */
.device-desktop .device-frame {
  width: 100%;
  height: 100%;
  transform: scale(1);
}

.device-tablet .device-frame {
  width: 768px;
  max-height: 1024px;
  transform: scale(0.9);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #334155;
}

.device-mobile .device-frame {
  width: 375px;
  max-height: 812px;
  transform: scale(0.8);
  border-radius: 24px;
  overflow: hidden;
  border: 3px solid #334155;
}

.preview-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}
</style>
```

---

## 6. PreviewToolbar.vue Component

### 6.1 File: `apps/landing/components/preview/PreviewToolbar.vue` (NEW)

```vue
<template>
  <div class="preview-toolbar">
    <!-- Device Toggle -->
    <div class="toolbar-left">
      <div class="device-toggle">
        <button
          v-for="d in devices"
          :key="d.value"
          :class="['device-btn', { active: device === d.value }]"
          :title="d.label"
          @click="$emit('device-change', d.value)"
        >
          <el-icon :size="16"><component :is="d.icon" /></el-icon>
        </button>
      </div>
    </div>

    <!-- URL Bar -->
    <div class="toolbar-center">
      <div class="url-display">
        <el-icon class="url-icon"><Link /></el-icon>
        <span class="url-text">{{ displayUrl }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="toolbar-right">
      <!-- Copy URL -->
      <button
        class="action-btn"
        title="Copy preview URL"
        @click="handleCopyUrl"
      >
        <el-icon v-if="!copied"><CopyDocument /></el-icon>
        <el-icon v-else class="copied-icon"><Check /></el-icon>
        <span v-if="copied" class="copied-text">Copied!</span>
      </button>

      <!-- Refresh -->
      <button
        v-if="showRefresh"
        class="action-btn"
        :class="{ 'is-spinning': isRefreshing }"
        title="Refresh preview"
        @click="handleRefresh"
      >
        <el-icon :class="{ spinning: isRefreshing }"><Refresh /></el-icon>
      </button>

      <!-- Open in new window -->
      <button
        class="action-btn"
        title="Open in new window"
        @click="$emit('open-new-window')"
      >
        <el-icon><TopRight /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Monitor, Iphone, View as TabletIcon, Link,
  CopyDocument, Check, Refresh, TopRight,
} from '@element-plus/icons-vue'

// ─── Props ───
const props = defineProps<{
  previewUrl?: string
  isLoading: boolean
  showRefresh: boolean
  device: 'desktop' | 'tablet' | 'mobile'
}>()

// ─── Emits ───
const emit = defineEmits<{
  refresh: []
  'open-new-window': []
  'device-change': [value: 'desktop' | 'tablet' | 'mobile']
}>()

// ─── State ───
const copied = ref(false)
const isRefreshing = ref(false)

// ─── Devices ───
const devices = [
  { value: 'desktop' as const, label: 'Desktop', icon: Monitor },
  { value: 'tablet' as const, label: 'Tablet', icon: TabletIcon },
  { value: 'mobile' as const, label: 'Mobile', icon: Iphone },
]

// ─── Computed ───
const displayUrl = computed(() => {
  if (props.previewUrl) return props.previewUrl
  return 'localhost:3000'
})

// ─── Methods ───
async function handleCopyUrl(): Promise<void> {
  const url = props.previewUrl || 'http://localhost:3000'
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Fallback for non-HTTPS contexts
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function handleRefresh(): void {
  isRefreshing.value = true
  emit('refresh')
  setTimeout(() => { isRefreshing.value = false }, 800)
}
</script>

<style scoped>
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
  gap: 12px;
}

/* ── Device Toggle ── */
.device-toggle {
  display: flex;
  background: #0f172a;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.device-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.device-btn:hover {
  color: #e2e8f0;
  background: #1e293b;
}

.device-btn.active {
  color: #3b82f6;
  background: #1e293b;
}

/* ── URL Display ── */
.url-display {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 480px;
  background: #0f172a;
  border-radius: 8px;
  padding: 6px 12px;
}

.url-icon {
  color: #64748b;
  flex-shrink: 0;
}

.url-text {
  font-size: 12px;
  font-family: 'IBM Plex Mono', monospace;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Action Buttons ── */
.toolbar-right {
  display: flex;
  gap: 4px;
}

.action-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  color: #e2e8f0;
  background: #0f172a;
}

.action-btn.is-spinning .spinning {
  animation: spin 0.8s linear;
}

.copied-icon {
  color: #22c55e;
}

.copied-text {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #22c55e;
  white-space: nowrap;
  background: #0f172a;
  padding: 2px 8px;
  border-radius: 4px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
```

---

## 7. WebSocket Integration

### 7.1 Preview Event Definitions

Two new WebSocket events to add to `apps/api/src/websocket/hub.ts`:

| Event Name | Direction | Payload | Description |
|------------|-----------|---------|-------------|
| `preview:status` | Server → Client | `{ projectId, status, port?, url?, error?, timestamp }` | Preview server status change |
| `preview:log` | Server → Client | `{ projectId, line }` | Real-time stdout/stderr log line |

### 7.2 Hub.ts Modification

Add to `apps/api/src/websocket/hub.ts` — modify `handleAuthenticatedConnection()` (line 139) to add preview handlers:

```typescript
// In handleAuthenticatedConnection(), add after setupTerminalHandlers(socket):

  // Preview event handlers
  setupPreviewHandlers(socket)
```

Add new function after `setupTerminalHandlers` (after line 306):

```typescript
// Preview event handlers
function setupPreviewHandlers(socket: Socket) {
  // Subscribe to preview status
  socket.on('preview:subscribe', (projectId: string) => {
    socket.join(`preview:${projectId}`)
    logger.info('[WebSocket] User subscribed to preview', { userId: socket.data.userId, projectId })
  })

  // Unsubscribe from preview
  socket.on('preview:unsubscribe', (projectId: string) => {
    socket.leave(`preview:${projectId}`)
    logger.info('[WebSocket] User unsubscribed from preview', { userId: socket.data.userId, projectId })
  })
}
```

### 7.3 Broadcast Extension

Add to the `broadcast` export object in `hub.ts` (after line 376):

```typescript
  // Broadcast preview status
  previewStatus: (projectId: string, status: string, extra?: Record<string, unknown>) => {
    io?.to(`preview:${projectId}`).emit('preview:status', {
      projectId,
      status,
      ...extra,
      timestamp: Date.now(),
    })
  },
```

### 7.4 Client-Side (`useSocket` composable)

The `PreviewPanel.vue` component subscribes to preview events via the existing `useSocket` composable pattern. The store `useChatStore` should also subscribe on project load:

```typescript
// In apps/landing/stores/chat.ts, add to loadConversations or a new action:

async subscribeToPreview(projectId: string): Promise<void> {
  const { on } = useSocket()
  on('preview:status', (data: any) => {
    if (data.projectId === projectId) {
      // Update preview state
      console.log('[Preview] Status:', data)
    }
  })
}
```

---

## 8. Lifecycle Management

### 8.1 Start Triggers

The preview server is started when the Generation Pipeline (AGENTHIVE-001) reaches its verification step successfully:

```typescript
// In apps/api/src/pipeline/verification.ts (NEW file per AGENTHIVE-001),
// after successful verification:

import { getPreviewServerManager } from '../services/preview-server.js'

export async function onVerificationSuccess(projectId: string, workspacePath: string): Promise<void> {
  const previewManager = getPreviewServerManager()
  await previewManager.start(projectId, workspacePath)
}

// Call from controller after verification passes:
//   await onVerificationSuccess(project.id, project.workspacePath)
```

### 8.2 Stop Triggers

The preview server is stopped when:
1. **User navigates away**: `PreviewPanel.onUnmounted()` could call `stop()`, but the idle timeout (5 min) handles this more reliably.
2. **Project is deleted**: Add to `apps/api/src/project/controller.ts`, `deleteProject()` handler:

```typescript
// In deleteProject controller:
import { getPreviewServerManager } from '../services/preview-server.js'
// Before deletion:
const previewManager = getPreviewServerManager()
await previewManager.stop(id)
```

3. **Idle timeout**: `PreviewServerManager.scheduleIdleCleanup()` handles this automatically.

### 8.3 Graceful Shutdown

Add to the API server's shutdown hook (in `apps/api/src/index.ts` or wherever `process.on('SIGTERM')` is handled):

```typescript
import { getPreviewServerManager } from './services/preview-server.js'

process.on('SIGTERM', async () => {
  logger.info('[Server] SIGTERM received, shutting down...')
  try {
    await getPreviewServerManager().cleanup()
  } catch (err) {
    logger.error('[Server] Preview cleanup failed', err as Error)
  }
  process.exit(0)
})
```

### 8.4 Redis Keys Design

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `agenthive:preview:allocated_ports` | SET | Infinite | Pool of available ports (5100-5199). SADD on init, SPOP for allocate, SADD for release. |
| `agenthive:preview:server:{projectId}` | HASH | 1 hour | Fields: `status`, `port`, `pid`, `startTime`. Written by PreviewServerManager. |
| `agenthive:preview:log:{projectId}` | LIST | 1 hour | Capped at 1000 entries via LTRIM. Each entry is a stdout/stderr line. |
| `agenthive:preview:last_access:{projectId}` | STRING | 10 minutes | Unix timestamp ms. Updated on each `touch()`. Used for LRU eviction. |
| `agenthive:preview:status:{projectId}` | STRING | 1 hour | JSON: `{ status, port, error? }`. Used for pub/sub and cross-pod state sharing. |

**Pub/Sub Channels** (ephemeral, no keys):

| Channel | Publisher | Subscribers | Purpose |
|---------|-----------|-------------|---------|
| `preview:status:{projectId}` | PreviewServerManager | WebSocket Hub → Clients | Real-time status broadcasts |
| `preview:log:{projectId}` | PreviewServerManager | WebSocket Hub → Clients | Real-time server log streaming |

---

## 9. Integration with Generation Pipeline (AGENTHIVE-001)

### 9.1 Call Chain

The full call chain from user input to live preview:

```
User sends message in ChatPanel
  → ChatControllerService.sendMessage()
  → classifyIntent() → intent = 'generate_app'
  → TemplateMatcher.match() → AppTemplate
  → WorkspaceInit.initialize() → workspacePath
  → Orchestrator.generateTickets() → Ticket[]
  → TaskExecutionService.execute() → LLM generates code
  → Verification.verifyProject() → { ok: true }
      │
      ▼  ─── THIS SPEC ───
  → PreviewServerManager.start(projectId, workspacePath)
      │
      ▼
  → child_process.spawn('npx', ['vite', '--port', port])
      │
      ▼
  → Health check loop (poll every 2s, timeout 30s)
      │
      ▼
  → WebSocket broadcast: preview:status { status: 'ready' }
      │
      ▼
  → PreviewPanel.vue transitions from 'loading' → 'preview'
      │
      ▼
  → iframe loads: src="/api/projects/{projectId}/preview/"
      │
      ▼
  → Preview proxy route → http-proxy-middleware → http://localhost:{port}
      │
      ▼
  → Vite dev server serves generated app with HMR
```

### 9.2 Required Changes to AGENTHIVE-001

In `specs/agenthive/001-generation-pipeline.md`, section 8 (Preview / Deploy), the previous placeholder should be updated to reference this spec:

```markdown
## 8. Preview / Deploy

After verification succeeds, the preview server is started automatically.
See AGENTHIVE-003 for the complete preview system specification.

Key call:
```typescript
import { getPreviewServerManager } from '../services/preview-server.js'
await getPreviewServerManager().start(projectId, workspacePath)
```

### 9.3 Frontend Transition Flow

```
PreviewPanel State Machine:

  [empty] ──(generation starts)──→ [loading]
                                      │
                        (WebSocket:preview:status=ready)
                                      │
                                      ▼
                                   [preview] ←── iframe renders app
                                      │
                        (idle timeout / project delete)
                                      │
                                      ▼
                                   [empty]

  [loading] ──(WebSocket:preview:status=error)──→ [error]
  [error]   ──(user clicks Retry)───────────────→ [loading]
  [error]   ──(user navigates away)─────────────→ [empty]
```

---

## 10. Error Handling Matrix

| Scenario | Backend Behavior | Frontend Behavior |
|----------|------------------|-------------------|
| Port range exhausted (all 5100-5199 used) | `allocatePort()` throws `Error` | PreviewPanel shows error state: "All preview slots in use" |
| `npx vite` fails to start | Process exits with code 1; `publishStatus('error')` | WebSocket triggers `error` state with exit code |
| Health check timeout (30s) | Mark as `error`; `publishStatus('error')` | PreviewPanel shows error with timeout message |
| Vite port conflict | Vite auto-increments port; health check on allocated port fails | Error state; admin sees correct port via logs |
| User closes tab (idle timeout) | `scheduleIdleCleanup()` stops after 5 min | N/A (tab is closed) |
| API server restart | All processes orphaned. On init, check for existing `server:{id}` keys and attempt re-attach or clean up. | Frontend re-connects WebSocket; status re-fetched |
| WebSocket disconnect | No effect on preview server; re-subscribe on reconnect | Iframe continues working; toolbar state resyncs on reconnect |
| Cross-pod (K8s) scenario | Redis `server:{id}` HASH is the source of truth. Only the pod that started the process can stop it. | WebSocket with Redis Adapter broadcasts to all pods |
| Proxy error (502 Bad Gateway) | `onError` callback renders HTML error page | Iframe displays styled error page with Retry button |

---

## 11. File Checklist

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/services/preview-server.ts` | **CREATE** | PreviewServerManager class (~280 lines) |
| `apps/api/src/routes/preview.ts` | **CREATE** | Preview proxy route with auth, rate limiting, error pages (~150 lines) |
| `apps/api/src/routes/index.ts` | **MODIFY** | Import and register preview routes (or add to project routes) |
| `apps/api/src/project/routes.ts` | **MODIFY** | Add `/:id/preview` sub-route pointing to preview proxy |
| `apps/landing/nuxt.config.ts` | **MODIFY** | Enable `devProxy` for `/api/projects/**/preview/**` with `ws: true` |
| `apps/landing/components/preview/PreviewPanel.vue` | **CREATE** | Main preview component with 4 states (~230 lines) |
| `apps/landing/components/preview/PreviewToolbar.vue` | **CREATE** | Toolbar with device toggle, copy, refresh, open-new-window (~180 lines) |
| `apps/landing/pages/chat/[chatId].vue` | **MODIFY** | Replace lines 133-152 (placeholder preview) with `<PreviewPanel>` component |
| `apps/api/src/websocket/hub.ts` | **MODIFY** | Add `setupPreviewHandlers()` and `broadcast.previewStatus()` (~30 lines) |
| `apps/api/src/index.ts` | **MODIFY** | Add graceful shutdown calling `previewServerManager.cleanup()` |
| `apps/api/src/pipeline/verification.ts` | **MODIFY** | Add `previewServerManager.start()` call on verification success |
| `apps/api/src/project/controller.ts` | **MODIFY** | Add `previewServerManager.stop()` in `deleteProject` handler |
| `specs/agenthive/001-generation-pipeline.md` | **MODIFY** | Update section 8 to reference this spec |

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest)

```typescript
// File: apps/api/src/services/__tests__/preview-server.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PreviewServerManager } from '../preview-server.js'

describe('PreviewServerManager', () => {
  let manager: PreviewServerManager

  beforeEach(() => {
    manager = new PreviewServerManager()
  })

  afterEach(async () => {
    await manager.cleanup()
  })

  it('should allocate a port from the pool', async () => {
    const port = await manager.allocatePort()
    expect(port).toBeGreaterThanOrEqual(5100)
    expect(port).toBeLessThanOrEqual(5199)
  })

  it('should track process lifecycle', async () => {
    const info = await manager.start('test-project', '/tmp/workspace')
    expect(info.status).toBe('starting')
    expect(info.port).toBeDefined()
  })

  it('should enforce max concurrent limit', async () => {
    // Start MAX_CONCURRENT_PREVIEWS servers
    // Next start() should evict LRU
  })

  it('should clean up on stop', async () => {
    const info = await manager.start('test-project', '/tmp/workspace')
    await manager.stop('test-project')
    const status = await manager.getStatus('test-project')
    expect(status.status).toBe('stopped')
  })
})
```

### 12.2 Integration Test (Playwright)

```typescript
// File: apps/landing/e2e/preview.spec.ts

import { test, expect } from '@playwright/test'

test('preview panel shows placeholder when no generation', async ({ page }) => {
  await page.goto('/chat/test-chat')
  await page.click('[data-testid="tab-preview"]')
  await expect(page.locator('.preview-empty')).toBeVisible()
})

test('preview panel transitions to loading on generation start', async ({ page }) => {
  // Simulate WebSocket message
  await page.evaluate(() => {
    window.postMessage({ type: 'preview:status', data: { status: 'starting' } }, '*')
  })
  await expect(page.locator('.preview-loading')).toBeVisible()
})

test('preview iframe loads on ready', async ({ page }) => {
  await page.evaluate(() => {
    window.postMessage({ type: 'preview:status', data: { status: 'ready', port: 5101 } }, '*')
  })
  const iframe = page.locator('.preview-iframe')
  await expect(iframe).toBeVisible()
  await expect(iframe).toHaveAttribute('src', /\/api\/projects\/.+\/preview\//)
})
```

### 12.3 Manual Verification Checklist

- [ ] `tsc --noEmit` passes in `apps/api` with zero errors
- [ ] `tsc --noEmit` passes in `apps/landing` with zero errors
- [ ] `node scripts/check-imports.js` finds no issues
- [ ] Starting a project generation triggers preview start
- [ ] Preview iframe loads the generated app
- [ ] Device toggle (Desktop/Tablet/Mobile) works
- [ ] Copy URL button copies correctly
- [ ] Refresh button reloads iframe
- [ ] Open in new window opens correct URL
- [ ] Idle timeout (5 min) stops preview
- [ ] Project delete stops and cleans up preview
- [ ] 11th preview evicts the oldest LRU process
- [ ] WebSocket status events are received by frontend
- [ ] Cross-pod scenario: status is readable from Redis on a different pod
