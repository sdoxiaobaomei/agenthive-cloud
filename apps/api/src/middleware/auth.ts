import type { Request, Response, NextFunction } from 'express'
import { resolveLocalUser } from '../services/userMapping.js'
import { userDb } from '../db/index.js'
import logger from '../utils/logger.js'

const PUBLIC_PATHS = [
  '/health',
  '/visitor-status',
  '/demo/',
  '/auth/login',
  '/auth/register',
  '/auth/sms/send',
  '/auth/refresh',
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
    // 修复：使用预定义的有效 UUID，并尝试创建 fallback 用户
    try {
      const fallbackUser = await userDb.create({
        username: devUserName || 'Developer',
        role: devUserRole || 'admin',
        external_user_id: devUserId,
      })
      ;(req as any).userId = fallbackUser.id
      ;(req as any).externalUserId = devUserId
      ;(req as any).user = {
        userId: fallbackUser.id,
        username: fallbackUser.username,
        role: fallbackUser.role,
      }
    } catch (createErr) {
      // 如果连创建都失败，记录错误并返回 false（让请求走 401）
      logger.error('Dev user fallback creation failed', createErr instanceof Error ? createErr : undefined)
      return false
    }
    return true
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

  // 生产环境：强制 Gateway 透传认证（P0-001 统一认证层设计）
  if (await resolveGatewayUser(req)) {
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
