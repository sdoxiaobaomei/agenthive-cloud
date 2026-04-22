import type { Request, Response, NextFunction } from 'express'

export interface VisitorRequest extends Request {
  visitorId?: string
}

interface VisitorRecord {
  createdAt: number
  windowStart: number
  requests: number
}

const visitorStore = new Map<string, VisitorRecord>()

const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 60

// 每小时清理超过24小时未访问的过期记录
setInterval(() => {
  const now = Date.now()
  for (const [id, record] of visitorStore.entries()) {
    if (now - record.createdAt > RATE_LIMIT_WINDOW * 24) {
      visitorStore.delete(id)
    }
  }
}, CLEANUP_INTERVAL)

export function visitorMiddleware(req: VisitorRequest, res: Response, next: NextFunction) {
  const isAuth = req.headers.authorization || req.cookies?.token
  if (isAuth) return next()

  let visitorId = req.cookies?.visitorId
  if (!visitorId) {
    visitorId = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    res.cookie('visitorId', visitorId, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 })
  }

  const record = visitorStore.get(visitorId)
  const now = Date.now()
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    // 新窗口
    visitorStore.set(visitorId, { createdAt: record?.createdAt ?? now, windowStart: now, requests: 1 })
  } else {
    record.requests++
    if (record.requests > MAX_REQUESTS) {
      return res.status(429).json({ error: 'Visitor rate limit exceeded. Please sign in.' })
    }
  }

  req.visitorId = visitorId
  next()
}
