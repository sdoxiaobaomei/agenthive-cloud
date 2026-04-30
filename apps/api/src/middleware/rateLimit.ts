import type { Request, Response, NextFunction } from 'express'
import { rateLimit, type Store, type IncrementResponse } from 'express-rate-limit'
import { redis, key } from '../config/redis.js'

// ─── Redis-backed Store for express-rate-limit ───
class RedisStore implements Store {
  prefix: string
  windowMs: number

  constructor(prefix: string) {
    this.prefix = prefix
    this.windowMs = 60000
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs
  }

  async increment(clientKey: string): Promise<IncrementResponse> {
    const fullKey = key(`ratelimit:${this.prefix}`, clientKey)
    const pipeline = redis.pipeline()
    pipeline.incr(fullKey)
    pipeline.pexpire(fullKey, this.windowMs)
    const results = await pipeline.exec()
    const totalHits = (results?.[0]?.[1] as number) ?? 1
    const resetTime = new Date(Date.now() + this.windowMs)
    return { totalHits, resetTime }
  }

  async decrement(clientKey: string): Promise<void> {
    const fullKey = key(`ratelimit:${this.prefix}`, clientKey)
    await redis.decr(fullKey)
  }

  async resetKey(clientKey: string): Promise<void> {
    const fullKey = key(`ratelimit:${this.prefix}`, clientKey)
    await redis.del(fullKey)
  }
}

// ─── Helper: build rate limiter with standard 429 response ───
function createLimiter(options: {
  prefix: string
  windowMs: number
  max: number
  skipSuccessfulRequests?: boolean
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      keyGeneratorIpFallback: false,
    },
    store: new RedisStore(options.prefix),
    keyGenerator: (req: Request) => {
      // Use authenticated user ID if available, otherwise IP
      const userId = req.headers['x-user-id'] || req.cookies?.token
      if (userId) return `user:${userId}`
      return `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`
    },
    skip: (req: Request) => {
      // Skip health checks and Swagger docs
      return req.path === '/api/health' || req.path.startsWith('/api-docs')
    },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        code: 429,
        message: 'Rate limit exceeded. Please slow down.',
        data: null,
      })
    },
  })
}

// ─── Tiered limiters ───

/** High-cost operations: Agent task execution (5/hour) */
export const agentExecutionLimiter = createLimiter({
  prefix: 'agent_exec',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
})

/** Agent commands: start/stop/pause/resume/command (10/hour) */
export const agentCommandLimiter = createLimiter({
  prefix: 'agent_cmd',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
})

/** General write operations: POST/PUT/DELETE (100/min) */
export const writeLimiter = createLimiter({
  prefix: 'write',
  windowMs: 60 * 1000, // 1 minute
  max: 100,
})

/** General read operations: GET (300/min) */
export const readLimiter = createLimiter({
  prefix: 'read',
  windowMs: 60 * 1000, // 1 minute
  max: 300,
})

// ─── Composite middleware: applies the strictest matching limiter ───
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method
  const path = req.path

  // Skip non-API paths and health checks
  if (!path.startsWith('/api') || path === '/api/health') {
    return next()
  }

  // High-cost: task/chat execution endpoints
  const isExecution =
    (method === 'POST' && /\/api\/chat\/sessions\/[^/]+\/execute$/.test(path)) ||
    (method === 'POST' && /\/api\/tasks\/[^/]+\/execute$/.test(path))

  if (isExecution) {
    return agentExecutionLimiter(req, res, next)
  }

  // Agent commands
  const isAgentCommand =
    method === 'POST' && /\/api\/agents\/[^/]+\/(start|stop|pause|resume|command)$/.test(path)

  if (isAgentCommand) {
    return agentCommandLimiter(req, res, next)
  }

  // Write operations
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    return writeLimiter(req, res, next)
  }

  // Read operations
  if (method === 'GET') {
    return readLimiter(req, res, next)
  }

  next()
}
