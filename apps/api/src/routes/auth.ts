/**
 * Auth 路由
 *
 * 提供用户注册接口，注册时先调用 Java auth-service 注册用户，
 * 再从返回的 accessToken 解析 JWT payload 获取 Java userId（sub），
 * 存入本地 users.external_user_id。
 *
 * 降级策略：
 * - Java 服务不可用（网络超时/宕机）：本地仍创建用户，syncStatus 标记为 pending
 * - Java 返回业务错误（如用户名已存在）：向前端返回对应错误码，不创建本地用户
 */

import { Router } from 'express'
import { z } from 'zod'
import { randomBytes, pbkdf2Sync } from 'crypto'
import { userDb } from '../utils/database.js'
import { createJavaUser, parseJwtPayload } from '../services/javaUserService.js'
import logger from '../utils/logger.js'

const router = Router()

const registerSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string()
    .min(8).max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      '密码必须包含大小写字母、数字和特殊字符'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional().or(z.literal('')),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
})

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
  return `pbkdf2_sha256$100000$${salt}$${hash}`
}

/**
 * POST /api/auth/register
 *
 * 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        code: 400,
        message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const { username, password, email, phone } = parseResult.data

    // 检查本地用户名是否已存在
    const existingUser = await userDb.findByUsername(username)
    if (existingUser) {
      return res.status(409).json({
        code: 409,
        message: '用户名已存在',
      })
    }

    // 步骤 1：调用 Java auth-service 注册用户
    const javaResult = await createJavaUser({
      username,
      password,
      email: email || undefined,
    })

    let externalUserId: string | undefined
    let syncStatus: 'synced' | 'pending' = 'synced'

    if (javaResult.success) {
      const jwtPayload = parseJwtPayload(javaResult.tokens.accessToken) as { sub?: string | number } | null
      externalUserId = jwtPayload?.sub ? String(jwtPayload.sub) : undefined
      logger.info('[Auth] Java user registered successfully', {
        username,
        javaUserId: externalUserId,
      })
    } else if (javaResult.statusCode === 409) {
      return res.status(409).json({
        code: 409,
        message: '用户名已存在',
      })
    } else if (javaResult.statusCode === 400) {
      return res.status(400).json({
        code: 400,
        message: '注册参数错误，请检查密码强度或用户名格式',
      })
    } else {
      // 网络超时或服务不可用：降级为本地创建
      syncStatus = 'pending'
      logger.warn('[Auth] Java auth-service unavailable, proceeding with local registration only', {
        username,
        error: javaResult.error,
      })
    }

    // 步骤 2：创建本地用户记录
    const localUser = await userDb.create({
      username,
      password_hash: hashPassword(password),
      email: email || undefined,
      phone: phone || undefined,
      external_user_id: externalUserId,
    })

    res.status(201).json({
      code: 201,
      message: '注册成功',
      data: {
        id: localUser.id,
        username: localUser.username,
        externalUserId: localUser.external_user_id,
        syncStatus,
      },
    })
  } catch (error) {
    logger.error('[Auth] Registration error', error instanceof Error ? error : undefined)
    res.status(500).json({
      code: 500,
      message: '注册失败，请稍后重试',
    })
  }
})

export default router
