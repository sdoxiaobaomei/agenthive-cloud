/**
 * Java Auth Service Client
 *
 * 调用 Java auth-service 的 REST API 进行用户注册。
 * 支持超时、降级、结构化日志。
 */

import logger from '../utils/logger.js'

const JAVA_AUTH_SERVICE_URL = process.env.JAVA_AUTH_SERVICE_URL || 'http://localhost:8081'
const JAVA_API_TIMEOUT_MS = 5000

export interface CreateJavaUserPayload {
  username: string
  password: string
  email?: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  isNewUser: boolean
}

export type CreateJavaUserResult =
  | { success: true; tokens: TokenResponse }
  | { success: false; error: string; statusCode?: number }

function parseJwtPayload(token: string): unknown {
  try {
    const base64 = token.split('.')[1]
    const json = Buffer.from(base64, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export { parseJwtPayload }

/**
 * 在 Java auth-service 注册用户
 *
 * @param payload 用户注册信息（含原始密码，Java 侧负责 BCrypt）
 * @returns 创建结果（含 TokenResponse）或错误信息
 */
export async function createJavaUser(payload: CreateJavaUserPayload): Promise<CreateJavaUserResult> {
  const url = `${JAVA_AUTH_SERVICE_URL}/auth/register`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), JAVA_API_TIMEOUT_MS)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_API_TOKEN || '',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      logger.warn('[JavaAuthService] Register user returned non-2xx', {
        status: res.status,
        response: text,
        username: payload.username,
      })
      return { success: false, error: `HTTP ${res.status}: ${text}`, statusCode: res.status }
    }

    const data = await res.json()
    // Java 统一返回格式: { code, message, data: TokenResponse }
    const tokenData = data.data as TokenResponse
    return { success: true, tokens: tokenData }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn('[JavaAuthService] Java auth-service unavailable', {
      error: msg,
      username: payload.username,
      url,
    })
    return { success: false, error: msg }
  }
}
