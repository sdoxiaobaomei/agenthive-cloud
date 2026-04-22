// JWT 工具函数
import crypto from 'crypto'
import { SignJWT, jwtVerify, decodeJwt } from 'jose'

const DEFAULT_SECRET = 'agenthive-secret-key-change-in-production'
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET

if (JWT_SECRET === DEFAULT_SECRET) {
  console.warn('[SECURITY WARNING] JWT_SECRET is using the default value. Please set a strong secret in production.')
}

const secret = new TextEncoder().encode(JWT_SECRET)

export interface JwtPayload {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}

export const jwt = {
  sign: async (payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> => {
    return new SignJWT(payload as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)
  },

  verify: async (token: string): Promise<JwtPayload | null> => {
    try {
      const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 })
      return payload as unknown as JwtPayload
    } catch {
      return null
    }
  },

  decode: (token: string): JwtPayload | null => {
    try {
      const payload = decodeJwt(token)
      return payload as unknown as JwtPayload
    } catch {
      return null
    }
  },
}

// 生成随机 Token
export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}
