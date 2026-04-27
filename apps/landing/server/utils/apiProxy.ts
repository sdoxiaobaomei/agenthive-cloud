/**
 * API 代理工具 - 将 Landing SSR 请求转发到后端 Gateway
 * P0-001 统一认证层：所有请求必须经过 Gateway，由 Gateway 验证 JWT 并注入 X-User-Id
 */
import { getHeader, getQuery, readBody, getMethod, setResponseStatus } from 'h3'

/**
 * 获取 Node API 直连地址（仅用于不经过 Gateway 的内部调用，如 WebSocket）
 * - Docker 环境: 使用 API_URL 环境变量 (http://api:3001)
 */
export function getApiBase(): string {
  if (process.env.API_URL) {
    return process.env.API_URL
  }
  try {
    const config = useRuntimeConfig()
    if (config.public?.apiBase) {
      return config.public.apiBase
    }
  } catch {
    // useRuntimeConfig 在部分场景下可能不可用
  }
  return 'http://localhost:3001'
}

/**
 * 获取 Gateway 基础地址（统一认证入口）
 * - P0-001 后，所有 HTTP API 请求（包括 projects/agents/chat）都走 Gateway
 * - Gateway 负责 JWT 验证、X-User-Id 注入、服务路由
 */
export function getGatewayBase(): string {
  if (process.env.GATEWAY_URL) {
    return process.env.GATEWAY_URL
  }
  return 'http://localhost:8080'
}

/**
 * 提取并转发 Authorization header
 */
export function getAuthHeader(event: any): Record<string, string> {
  const headers: Record<string, string> = {}
  const authHeader = getHeader(event, 'authorization')
  if (authHeader) {
    headers['Authorization'] = authHeader
  }
  return headers
}

/**
 * 代理请求到后端 Gateway
 * @param event H3Event
 * @param path 后端 API 路径 (如 /api/agents)
 * @param options 额外选项
 * @param baseUrl 自定义基础地址（默认走 Gateway，特殊场景可指定直连 API）
 */
export async function proxyToApi(
  event: any,
  path: string,
  options?: {
    method?: string
    body?: any
    query?: Record<string, any>
  },
  baseUrl?: string
): Promise<any> {
  const apiBase = baseUrl || getGatewayBase()
  const query = options?.query || getQuery(event)
  const queryParams = new URLSearchParams()
  for (const [k, v] of Object.entries(query as Record<string, any>)) {
    if (v !== undefined && v !== null) {
      queryParams.append(k, String(v))
    }
  }
  const queryString = queryParams.toString()

  const url = `${apiBase}${path}${queryString ? '?' + queryString : ''}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(event),
  }

  const method = options?.method || getMethod(event) || 'GET'
  const body = options?.body !== undefined ? options.body : (method !== 'GET' ? await readBody(event) : undefined)

  try {
    const result = await $fetch(url, {
      method: method as any,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return result as any
  } catch (error: any) {
    // 转发后端错误响应（保持 HTTP 状态码和前端期望的格式）
    const status = error.response?.status || 500
    const data = error.response?._data || { success: false, error: error.message || '后端服务不可用' }
    setResponseStatus(event, status)
    return data
  }
}
