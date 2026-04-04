import type { Request, Response, NextFunction } from 'express'

const PUBLIC_PATHS = ['/health', '/visitor-status', '/demo/', '/auth/']

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_PATHS.some((p) => req.path.includes(p))) {
    return next()
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // In production: verify JWT here
  ;(req as any).userId = 'verified-user'
  next()
}
