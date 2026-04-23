/**
 * API 代理工具 - 将 Landing SSR 请求转发到后端 API
 */
import { getHeader, getQuery, readBody, getMethod, setResponseStatus } from 'h3'

/**
 * 获取后端 API 基础地址
 * - Docker 环境: 使用 API_URL 环境变量 (http://api:3001)
 * - 本地开发: 使用 runtimeConfig.public.apiBase 或 localhost:3001
 */
export function getApiBase(): string {
  // Docker Compose 会注入 API_URL
  if (process.env.API_URL) {
    return process.env.API_URL
  }
  // Nuxt runtime config (SSR 端可用)
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
 * 代理请求到后端 API
 * @param event H3Event
 * @param path 后端 API 路径 (如 /api/agents)
 * @param options 额外选项
 */
export async function proxyToApi(
  event: any,
  path: string,
  options?: {
    method?: string
    body?: any
    query?: Record<string, any>
  }
): Promise<any> {
  const apiBase = getApiBase()
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
