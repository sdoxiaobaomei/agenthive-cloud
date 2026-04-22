// 认证控制器
import type { Request, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { userDb, delay } from '../utils/database.js'
import { jwt } from '../utils/jwt.js'
import { smsService } from '../services/sms.js'
import logger from '../utils/logger.js'

const sendSmsSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
})

const loginBySmsSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  code: z.string().min(4).max(8),
})

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const registerSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(1),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional().or(z.literal('')),
  code: z.string().optional(),
})

/**
 * 发送短信验证码
 * POST /api/auth/sms/send
 */
export const sendSmsCode = async (req: Request, res: Response) => {
  try {
    const parseResult = sendSmsSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: '手机号格式不正确' })
    }
    const { phone } = parseResult.data
    const result = await smsService.sendCode(phone, 'SMS_LOGIN')
    if (!result.success) {
      return res.status(429).json({ success: false, error: result.message })
    }
    res.json({
      success: true,
      message: '验证码发送成功',
      requestId: result.requestId,
      ...(result.devCode && { devCode: result.devCode }),
    })
  } catch (error) {
    logger.error('Send SMS error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '发送验证码失败' })
  }
}

/**
 * 短信验证码登录
 * POST /api/auth/login/sms
 */
export const loginBySms = async (req: Request, res: Response) => {
  try {
    await delay(500)
    const parseResult = loginBySmsSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: '手机号和验证码不能为空' })
    }
    const { phone, code } = parseResult.data
    const verifyResult = await smsService.verifyCode(phone, code)
    if (!verifyResult.success) {
      return res.status(401).json({ success: false, error: verifyResult.message })
    }
    let user = await userDb.findByPhone(phone)
    if (!user) {
      user = await userDb.create({
        phone,
        username: `user_${phone.slice(-4)}`,
        role: 'user',
      })
    }
    const token = await jwt.sign({
      userId: user.id,
      username: user.username,
      role: user.role,
    })
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      },
    })
  } catch (error) {
    logger.error('Login by SMS error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '登录失败' })
  }
}

/**
 * 传统用户名密码登录（兼容旧接口）
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    await delay(500)
    const parseResult = loginSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: '用户名和密码不能为空' })
    }
    const { username, password } = parseResult.data
    const user = await userDb.findByUsername(username)
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' })
    }
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' })
    }
    const token = await jwt.sign({
      userId: user.id,
      username: user.username,
      role: user.role,
    })
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    })
  } catch (error) {
    logger.error('Login error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '登录失败' })
  }
}

/**
 * 用户注册
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    await delay(500)
    const parseResult = registerSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const { username, email, phone, code, password } = parseResult.data
    if (phone && code) {
      const verifyResult = await smsService.verifyCode(phone, code)
      if (!verifyResult.success) {
        return res.status(401).json({ success: false, error: verifyResult.message })
      }
    }
    const allUsers = await userDb.getAll()
    const existingUser = allUsers.find((u: any) => u.username === username)
    if (existingUser) {
      return res.status(409).json({ success: false, error: '用户名已存在' })
    }
    const password_hash = await bcrypt.hash(password, 10)
    const user = await userDb.create({ username, email, phone, role: 'user', password_hash })
    const token = await jwt.sign({
      userId: user.id,
      username: user.username,
      role: user.role,
    })
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
    })
  } catch (error) {
    logger.error('Register error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '注册失败' })
  }
}

/**
 * 用户登出
 * POST /api/auth/logout
 */
export const logout = async (_req: Request, res: Response) => {
  try {
    await delay(200)
    res.json({ success: true, message: '登出成功' })
  } catch (error) {
    logger.error('Logout error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '登出失败' })
  }
}

/**
 * 刷新 Token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    await delay(200)
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '未提供 Token' })
    }
    const token = authHeader.slice(7)
    const payload = await jwt.verify(token)
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Token 无效或已过期' })
    }
    const user = await userDb.findById(payload.userId)
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' })
    }
    const newToken = await jwt.sign({
      userId: user.id,
      username: user.username,
      role: user.role,
    })
    res.json({
      success: true,
      data: {
        token: newToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
    })
  } catch (error) {
    logger.error('Refresh token error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '刷新 Token 失败' })
  }
}

/**
 * 获取当前用户
 * GET /api/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    await delay(200)
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '未提供 Token' })
    }
    const token = authHeader.slice(7)
    const payload = await jwt.verify(token)
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Token 无效或已过期' })
    }
    const user = await userDb.findById(payload.userId)
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' })
    }
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    logger.error('Get current user error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取用户信息失败' })
  }
}
