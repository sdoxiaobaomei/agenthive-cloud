/**
 * 认证相关类型定义
 */

/** 登录参数 */
export interface LoginParams {
  username: string
  password: string
}

/** 短信登录参数 */
export interface SmsLoginParams {
  phone: string
  code: string
}

/** 注册参数 */
export interface RegisterParams {
  name: string
  username?: string
  phone: string
  code: string
  password: string
}

/** 发送短信参数 */
export interface SendSmsParams {
  phone: string
  type: 'login' | 'register' | 'reset'
}

/** 短信验证码存储 */
export interface SmsCode {
  phone: string
  code: string
  expiresAt: number
  attempts: number
}

/** 认证响应 */
export interface AuthResponse {
  token: string
  user: import('./user').User
  expiresIn?: number
}

/** JWT Token 载荷 */
export interface JwtPayload {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}
