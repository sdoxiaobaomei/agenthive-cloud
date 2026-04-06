// JWT 工具函数
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'agenthive-secret-key-change-in-production'
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

export interface JwtPayload {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}

// 简单的 JWT 实现（生产环境建议使用 jsonwebtoken 库）
export const jwt = {
  sign: (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
    const now = Math.floor(Date.now() / 1000)
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + TOKEN_EXPIRY / 1000,
    }
    
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url')
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url')
    
    return `${header}.${body}.${signature}`
  },
  
  verify: (token: string): JwtPayload | null => {
    try {
      const [header, body, signature] = token.split('.')
      if (!header || !body || !signature) return null
      
      // 验证签名
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url')
      
      if (signature !== expectedSignature) return null
      
      // 解析 payload
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload
      
      // 检查过期时间
      if (payload.exp < Math.floor(Date.now() / 1000)) return null
      
      return payload
    } catch {
      return null
    }
  },
  
  decode: (token: string): JwtPayload | null => {
    try {
      const [, body] = token.split('.')
      if (!body) return null
      return JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload
    } catch {
      return null
    }
  },
}

// 生成随机 Token
export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}
