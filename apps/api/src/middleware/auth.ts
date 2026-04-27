import type { Request, Response, NextFunction } from 'express'
import { createHmac } from 'crypto'
import { resolveLocalUser } from '../services/userMapping.js'
import logger from '../utils/logger.js'

const PUBLIC_PATHS = [
  '/health',
  '/visitor-status',
  '/demo/',
  '/api-docs',
  '/swagger-ui',
  '/api-docs.json',
]

/**
 * 开发环境模拟用户注入（用于本地直连调试，不走 Gateway）
 * 会自动在数据库中创建/查找本地用户映射，避免外键约束失败
 */
async function injectDevUser(req: Request): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') return false

  const devUserId = process.env.DEV_USER_ID || 'dev-user-id'
  const devUserName = process.env.DEV_USER_NAME || 'Developer'
  const devUserRole = process.env.DEV_USER_ROLE || 'admin'

  try {
    const localUser = await resolveLocalUser({
      externalId: devUserId,
      username: devUserName,
      role: devUserRole,
    })

    ;(req as any).userId = localUser.id
    ;(req as any).externalUserId = devUserId
    ;(req as any).user = {
      userId: localUser.id,
      username: localUser.username,
      role: localUser.role,
    }
    return true
  } catch (error) {
    logger.error('Dev user injection failed', error instanceof Error ? error : undefined)
    // 降级：直接注入，不保证数据库有记录（可能后续仍会外键失败）
    ;(req as any).userId = devUserId
    ;(req as any).externalUserId = devUserId
    ;(req as any).user = {
      userId: devUserId,
      username: devUserName,
      role: devUserRole,
    }
    return true
  }
}

/**
 * 轻量 JWT 验证（HS256），用于 Landing BFF 直接调用时的身份解析
 */
function verifyJwt(token: string, secret: string): { sub?: string; username?: string; roles?: string } | null {
  const [headerB64, payloadB64, signature] = token.split('.')
  if (!headerB64 || !payloadB64 || !signature) return null

  const expectedSig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url')

  if (signature !== expectedSig) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
    if (payload.exp && Date.now() >= payload.exp * 1000) return null
    return payload
  } catch {
    return null
  }
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
 * 从 Authorization header 解析 JWT 并解析用户身份
 * 用于 Landing BFF 直接调用 API（不经过 Gateway）的场景
 */
async function resolveJwtUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization as string | undefined
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false

  const token = authHeader.substring(7)
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    logger.warn('JWT_SECRET not configured, cannot verify token')
    return false
  }

  const payload = verifyJwt(token, jwtSecret)
  if (!payload || !payload.sub) return false

  try {
    const localUser = await resolveLocalUser({
      externalId: payload.sub,
      username: payload.username,
      role: payload.roles,
    })

    ;(req as any).userId = localUser.id
    ;(req as any).externalUserId = payload.sub
    ;(req as any).user = {
      userId: localUser.id,
      username: localUser.username,
      role: localUser.role,
    }
    return true
  } catch (error) {
    logger.error('JWT user resolution failed', error instanceof Error ? error : undefined)
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

  // 开发环境：注入模拟用户（仅本地开发使用）
  const devUserInjected = await injectDevUser(req)
  if (devUserInjected) {
    return next()
  }

  // 生产环境：优先 Gateway 透传，其次自己解析 JWT
  // Landing BFF 直接调用时只带 Authorization，不设置 X-User-Id
  if (await resolveGatewayUser(req)) {
    return next()
  }
  if (await resolveJwtUser(req)) {
    return next()
  }

  return res.status(401).json({
    code: 401,
    message: 'Missing gateway authentication header (X-User-Id)',
    data: null,
  })
}

export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // 测试环境
  if (process.env.NODE_ENV === 'test') {
    ;(req as any).userId = 'test-user-id'
    ;(req as any).user = { userId: 'test-user-id', role: 'admin' }
    return next()
  }

  // 开发环境模拟
  const devUserInjectedOpt = await injectDevUser(req)
  if (devUserInjectedOpt) {
    return next()
  }

  // Gateway 透传（可选，失败不阻断）
  const externalId = req.headers['x-user-id'] as string | undefined
  if (externalId) {
    try {
      const localUser = await resolveLocalUser({
        externalId,
        username: req.headers['x-user-name'] as string | undefined,
        role: req.headers['x-user-role'] as string | undefined,
      })
      ;(req as any).userId = localUser.id
      ;(req as any).user = {
        userId: localUser.id,
        username: localUser.username,
        role: localUser.role,
      }
    } catch (error) {
      logger.warn('Optional auth: gateway user resolution failed', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  next()
}
