import type { Request, Response, NextFunction } from 'express'

export interface VisitorRequest extends Request {
  visitorId?: string
}

const visitorStore = new Map<string, { createdAt: number; requests: number }>()

export function visitorMiddleware(req: VisitorRequest, res: Response, next: NextFunction) {
  const isAuth = req.headers.authorization || req.cookies?.token
  if (isAuth) return next()

  let visitorId = req.cookies?.visitorId
  if (!visitorId) {
    visitorId = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    res.cookie('visitorId', visitorId, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 })
  }

  const record = visitorStore.get(visitorId) || { createdAt: Date.now(), requests: 0 }
  record.requests++
  visitorStore.set(visitorId, record)

  // Rate limit: 60 requests per hour
  if (record.requests > 60) {
    return res.status(429).json({ error: 'Visitor rate limit exceeded. Please sign in.' })
  }

  req.visitorId = visitorId
  next()
}
