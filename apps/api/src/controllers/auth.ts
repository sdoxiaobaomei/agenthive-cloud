// 认证控制器
import type { Request, Response } from 'express'
import { userDb, delay } from '../utils/database.js'
import { jwt } from '../utils/jwt.js'
import { smsService } from '../services/sms.js'

/**
 * 发送短信验证码
 * POST /api/auth/sms/send
 */
export const sendSmsCode = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '手机号不能为空',
      })
    }
    
    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: '手机号格式不正确',
      })
    }
    
    const result = await smsService.sendCode(phone, 'SMS_LOGIN')
    
    if (!result.success) {
      return res.status(429).json({
        success: false,
        error: result.message,
      })
    }
    
    res.json({
      success: true,
      message: '验证码发送成功',
      requestId: result.requestId,
      // 开发环境返回验证码
      ...(result.devCode && { devCode: result.devCode }),
    })
  } catch (error) {
    console.error('Send SMS error:', error)
    res.status(500).json({
      success: false,
      error: '发送验证码失败',
    })
  }
}

/**
 * 短信验证码登录
 * POST /api/auth/login/sms
 */
export const loginBySms = async (req: Request, res: Response) => {
  try {
    await delay(500)
    
    const { phone, code } = req.body
    
    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: '手机号和验证码不能为空',
      })
    }
    
    // 验证短信验证码
    const verifyResult = await smsService.verifyCode(phone, code)
    
    if (!verifyResult.success) {
      return res.status(401).json({
        success: false,
        error: verifyResult.message,
      })
    }
    
    // 查找或创建用户
    let user = await userDb.findByPhone(phone)
    
    if (!user) {
      // 新用户注册
      user = await userDb.create({
        phone,
        username: `user_${phone.slice(-4)}`,
        role: 'user',
      })
    }
    
    // 生成 JWT
    const token = jwt.sign({
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
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      error: '登录失败',
    })
  }
}

/**
 * 传统用户名密码登录（兼容旧接口）
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    await delay(500)
    
    const { username, password } = req.body
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空',
      })
    }
    
    // Mock 验证 - 任何用户名密码都接受
    const allUsers = await userDb.getAll()
    let user = allUsers.find(u => u.username === username)
    
    if (!user) {
      user = await userDb.create({
        username,
        role: 'user',
      })
    }
    
    const token = jwt.sign({
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
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      error: '登录失败',
    })
  }
}

/**
 * 用户注册
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    await delay(500)
    
    const { username, email, password, phone, code } = req.body
    
    // 如果提供了手机号和验证码，先验证
    if (phone && code) {
      const verifyResult = await smsService.verifyCode(phone, code)
      if (!verifyResult.success) {
        return res.status(401).json({
          success: false,
          error: verifyResult.message,
        })
      }
    }
    
    if (!username) {
      return res.status(400).json({
        success: false,
        error: '用户名不能为空',
      })
    }
    
    // 检查用户名是否已存在
    const allUsers = await userDb.getAll()
    const existingUser = allUsers.find(u => u.username === username)
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: '用户名已存在',
      })
    }
    
    // 创建新用户
    const user = await userDb.create({
      username,
      email,
      phone,
      role: 'user',
    })
    
    const token = jwt.sign({
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
    console.error('Register error:', error)
    res.status(500).json({
      success: false,
      error: '注册失败',
    })
  }
}

/**
 * 用户登出
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response) => {
  try {
    await delay(200)
    
    // 客户端删除 Token 即可
    res.json({
      success: true,
      message: '登出成功',
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      error: '登出失败',
    })
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
      return res.status(401).json({
        success: false,
        error: '未提供 Token',
      })
    }
    
    const token = authHeader.slice(7)
    const payload = jwt.verify(token)
    
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Token 无效或已过期',
      })
    }
    
    const user = await userDb.findById(payload.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      })
    }
    
    const newToken = jwt.sign({
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
    console.error('Refresh token error:', error)
    res.status(500).json({
      success: false,
      error: '刷新 Token 失败',
    })
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
      return res.status(401).json({
        success: false,
        error: '未提供 Token',
      })
    }
    
    const token = authHeader.slice(7)
    const payload = jwt.verify(token)
    
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Token 无效或已过期',
      })
    }
    
    const user = await userDb.findById(payload.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      })
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
    console.error('Get current user error:', error)
    res.status(500).json({
      success: false,
      error: '获取用户信息失败',
    })
  }
}
