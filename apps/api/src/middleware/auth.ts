import type { Request, Response, NextFunction } from 'express'
import { jwt } from '../utils/jwt.js'
import logger from '../utils/logger.js'

const PUBLIC_PATHS = [
  '/health',
  '/visitor-status',
  '/demo/',
  '/auth/login',
  '/auth/register',
  '/auth/sms/',
]

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_PATHS.some((p) => req.path.includes(p))) {
    return next()
  }

  // 测试环境下自动通过认证
  if (process.env.NODE_ENV === 'test') {
    ;(req as any).userId = 'test-user-id'
    ;(req as any).user = { userId: 'test-user-id', role: 'admin' }
    return next()
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    const payload = await jwt.verify(token)
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' })
    }

    ;(req as any).userId = payload.userId
    ;(req as any).user = payload
    next()
  } catch (error) {
    logger.error('Auth middleware error', error instanceof Error ? error : undefined)
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token
  if (token) {
    try {
      const payload = await jwt.verify(token)
      if (payload) {
        ;(req as any).userId = payload.userId
        ;(req as any).user = payload
      }
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next()
}
