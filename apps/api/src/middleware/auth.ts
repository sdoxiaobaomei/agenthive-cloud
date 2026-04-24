import type { Request, Response, NextFunction } from 'express'
import { jwt } from '../utils/jwt.js'
import { resolveLocalUser } from '../services/userMapping.js'
import logger from '../utils/logger.js'

const PUBLIC_PATHS = [
  '/health',
  '/visitor-status',
  '/demo/',
]

/**
 * 生产模式（Gateway 透传）判断
 */
function isGatewayMode(req: Request): boolean {
  return !!req.headers['x-user-id']
}

/**
 * 从 Gateway 透传 header 解析用户身份
 */
async function resolveGatewayUser(req: Request): Promise<boolean> {
  const externalId = req.headers['x-user-id'] as string | undefined
  if (!externalId) return false

  try {
    const localUser = await resolveLocalUser({
      externalId,
      username: req.headers['x-user-name'] as string | undefined,
      role: req.headers['x-user-role'] as string | undefined,
    })

    ;(req as any).userId = localUser.id
    ;(req as any).externalUserId = externalId
    ;(req as any).user = {
      userId: localUser.id,
      username: localUser.username,
      role: localUser.role,
    }
    return true
  } catch (error) {
    logger.error('Gateway user resolution failed', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * 从本地 JWT 解析用户身份（开发直连模式）
 */
async function resolveLocalToken(req: Request): Promise<boolean> {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token
  if (!token) return false

  try {
    const payload = await jwt.verify(token)
    if (!payload) return false

    ;(req as any).userId = payload.userId
    ;(req as any).user = payload
    return true
  } catch {
    return false
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 白名单路径直接放行
  if (PUBLIC_PATHS.some((p) => req.path.includes(p))) {
    return next()
  }

  // 测试环境下自动通过认证
  if (process.env.NODE_ENV === 'test') {
    ;(req as any).userId = 'test-user-id'
    ;(req as any).user = { userId: 'test-user-id', role: 'admin' }
    return next()
  }

  // 模式 A：Gateway 透传（生产环境）
  if (isGatewayMode(req)) {
    const resolved = await resolveGatewayUser(req)
    if (resolved) {
      return next()
    }
    return res.status(401).json({ success: false, error: 'Invalid gateway user identity' })
  }

  // 模式 B：本地 JWT 验证（开发直连模式）
  const resolved = await resolveLocalToken(req)
  if (resolved) {
    return next()
  }

  return res.status(401).json({ success: false, error: 'Unauthorized' })
}

export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // 模式 A：Gateway 透传
  if (isGatewayMode(req)) {
    await resolveGatewayUser(req)
    return next()
  }

  // 模式 B：本地 JWT 验证
  await resolveLocalToken(req)
  next()
}
