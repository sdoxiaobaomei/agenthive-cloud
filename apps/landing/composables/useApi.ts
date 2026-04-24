import type { Ref } from 'vue'

// ============ 类型定义 ============

/** API 统一响应格式 */
export interface ApiResponse<T = any> {
  success: boolean
  data: T | null
  error: ApiError | null
  message: string
}

/** API 错误信息 */
export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

/** 请求配置选项 */
export interface RequestOptions {
  headers?: Record<string, string>
  skipAuth?: boolean
  timeout?: number
  /** 是否静默模式（不显示全局 loading） */
  silent?: boolean
  /** 自定义 loading 文本 */
  loadingText?: string
}

/** 分页请求参数 */
export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/** 分页响应数据 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============ 实体类型定义 ============

/** 用户信息 (与 @agenthive/types 对齐) */
export interface User {
  id: string
  username: string
  name: string
  email?: string
  phone?: string
  role: string
  avatar?: string
  createdAt: string
  updatedAt: string
}

/** Agent 状态 */
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'stopped'

/** Agent 信息 */
export interface Agent {
  id: string
  name: string
  description?: string
  type: string
  status: AgentStatus
  config: Record<string, any>
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}

/** Agent 日志 */
export interface AgentLog {
  id: string
  agentId: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  metadata?: Record<string, any>
  timestamp: string
}

/** 任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 任务信息 */
export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  agentId?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  tags: string[]
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}

/** 文件信息 */
export interface FileInfo {
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
  modifiedAt: string
  children?: FileInfo[]
}

/** 文件内容 */
export interface FileContent {
  path: string
  name: string
  content: string
  language: string
  encoding: string
}

// ============ 请求参数类型 ============

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
  phone: string
  code: string
  password: string
}

/** 发送短信参数 */
export interface SendSmsParams {
  phone: string
  type: 'login' | 'register' | 'reset'
}

/** 创建 Agent 参数 */
export interface CreateAgentParams {
  name: string
  description?: string
  type: string
  config?: Record<string, any>
  metadata?: Record<string, any>
}

/** 更新 Agent 参数 */
export interface UpdateAgentParams {
  name?: string
  description?: string
  config?: Record<string, any>
  metadata?: Record<string, any>
}

/** 创建任务参数 */
export interface CreateTaskParams {
  title: string
  description?: string
  agentId?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  tags?: string[]
  metadata?: Record<string, any>
}

/** 更新任务参数 */
export interface UpdateTaskParams {
  title?: string
  description?: string
  agentId?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  tags?: string[]
  status?: TaskStatus
  metadata?: Record<string, any>
}

/** 更新文件参数 */
export interface UpdateFileParams {
  content: string
  encoding?: string
  message?: string
}

/** Chat 会话 */
export interface ChatSession {
  id: string
  userId: string
  projectId?: string
  title?: string
  status: string
  createdAt: string
  updatedAt: string
}

/** Chat 消息 */
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  content: string
  metadata?: Record<string, any>
  createdAt: string
}

/** 创建会话参数 */
export interface CreateChatSessionParams {
  projectId?: string
  title?: string
}

/** 发送消息参数 */
export interface SendChatMessageParams {
  content: string
}

// ============ API 错误类 ============

export class ApiException extends Error {
  public readonly code: string
  public readonly status: number
  public readonly details?: Record<string, string[]>

  constructor(error: ApiError, status: number = 500) {
    super(error.message)
    this.name = 'ApiException'
    this.code = error.code
    this.status = status
    this.details = error.details
  }
}

// ============ useApi 组合式函数 ============

export function useApi() {
  const config = useRuntimeConfig()
  const { token } = useAuth()
  const { startLoading, stopLoading } = useLoading()
  // 配置 API Base URL
  // - 客户端: 生产环境访问公网 API，开发环境访问本地端口
  // - SSR 服务端: 访问容器内 API 服务
  const baseUrl = import.meta.client
    ? (config.public.apiBase || '/api')
    : 'http://api:3001'

  // 默认超时时间（毫秒）
  const DEFAULT_TIMEOUT = 30000

  /**
   * 获取请求头
   */
  const getHeaders = (options?: RequestOptions): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers,
    }

    // 自动注入 JWT Token（除非 skipAuth 为 true）
    if (!options?.skipAuth) {
      // useAuth() 已经与 Pinia store 同步，直接读取即可
      const currentToken = token?.value || null
      
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`
      }
    }

    return headers
  }

  /**
   * 构建完整 URL
   */
  const buildUrl = (path: string): string => {
    // 如果 path 以 http 开头，直接使用
    if (path.startsWith('http')) {
      return path
    }
    // 确保 path 以 / 开头
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    
    // 如果 baseUrl 为空，直接返回 path（相对路径）
    if (!baseUrl) {
      return cleanPath
    }
    
    // 如果 baseUrl 以 /api 结尾且 path 也以 /api 开头，去重
    if (baseUrl.endsWith('/api') && cleanPath.startsWith('/api')) {
      return `${baseUrl}${cleanPath.slice(4)}`
    }
    return `${baseUrl}${cleanPath}`
  }

  /**
   * 基础请求封装
   * 
   * 自动集成全局 loading 控制：
   * - 请求开始时自动显示 loading（除非 options.silent = true）
   * - 请求结束时自动关闭 loading
   * - 支持并发请求，计数器确保所有请求完成后才真正关闭
   */
  const request = async <T = any>(
    method: string,
    path: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> => {
    const url = buildUrl(path)
    const headers = getHeaders(options)
    const timeout = options?.timeout || DEFAULT_TIMEOUT

    // 启动全局 loading（非静默模式）
    if (!options?.silent) {
      startLoading(options?.loadingText)
    }

    // 构建请求配置
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers,
      credentials: 'include',
    }

    // 添加请求体（非 GET 请求）
    if (data && method.toUpperCase() !== 'GET') {
      fetchOptions.body = JSON.stringify(data)
    }

    // 创建 AbortController 用于超时控制
    const controller = new AbortController()
    fetchOptions.signal = controller.signal
    
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)

    try {
      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)

      // 解析响应
      let result: any
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        const text = await response.text()
        result = { success: response.ok, data: text, message: text }
      }

      // 处理 HTTP 错误状态
      if (!response.ok) {
        const error: ApiError = {
          code: result.code || `HTTP_${response.status}`,
          message: result.message || result.error || `请求失败: ${response.statusText}`,
          details: result.details,
        }
        
        // 特殊处理认证错误
        if (response.status === 401) {
          // 可以在这里触发登出逻辑
          console.warn('认证已过期，请重新登录')
        }

        return {
          success: false,
          data: null,
          error,
          message: error.message,
        }
      }

      // 处理业务错误（即使 HTTP 200，但业务逻辑错误）
      if (result.success === false) {
        return {
          success: false,
          data: null,
          error: {
            code: result.code || 'BUSINESS_ERROR',
            message: result.message || '业务处理失败',
            details: result.details,
          },
          message: result.message || '业务处理失败',
        }
      }

      // 成功响应
      return {
        success: true,
        data: result.data ?? result,
        error: null,
        message: result.message || '请求成功',
      }

    } catch (error: any) {
      clearTimeout(timeoutId)

      // 处理超时错误
      if (error.name === 'AbortError') {
        return {
          success: false,
          data: null,
          error: {
            code: 'TIMEOUT',
            message: '请求超时，请稍后重试',
          },
          message: '请求超时，请稍后重试',
        }
      }

      // 处理网络错误
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return {
          success: false,
          data: null,
          error: {
            code: 'NETWORK_ERROR',
            message: '网络连接失败，请检查网络设置',
          },
          message: '网络连接失败，请检查网络设置',
        }
      }

      // 其他错误
      return {
        success: false,
        data: null,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error.message || '未知错误',
        },
        message: error.message || '未知错误',
      }
    } finally {
      // 关闭全局 loading（非静默模式）
      if (!options?.silent) {
        stopLoading()
      }
    }
  }

  // ============ 快捷方法 ============

  const get = <T = any>(path: string, options?: RequestOptions) => 
    request<T>('GET', path, undefined, options)

  const post = <T = any>(path: string, data?: any, options?: RequestOptions) => 
    request<T>('POST', path, data, options)

  const patch = <T = any>(path: string, data?: any, options?: RequestOptions) => 
    request<T>('PATCH', path, data, options)

  const put = <T = any>(path: string, data?: any, options?: RequestOptions) => 
    request<T>('PUT', path, data, options)

  const del = <T = any>(path: string, options?: RequestOptions) => 
    request<T>('DELETE', path, undefined, options)

  // ============ 认证相关 API ============

  const auth = {
    /** 发送短信验证码 */
    sendSms: (params: SendSmsParams) => 
      post<{ expiresIn: number }>('/api/auth/sms/send', params, { skipAuth: true, silent: true }),

    /** 短信登录 */
    loginBySms: (params: SmsLoginParams) => 
      post<{ token: string; user: User }>('/api/auth/login/sms', params, { skipAuth: true }),

    /** 用户名密码登录 */
    login: (params: LoginParams) => 
      post<{ token: string; user: User }>('/api/auth/login', params, { skipAuth: true }),

    /** 注册 */
    register: (params: RegisterParams) => 
      post<{ token: string; user: User }>('/api/auth/register', params, { skipAuth: true }),

    /** 登出 */
    logout: () => post<void>('/api/auth/logout'),

    /** 刷新 Token */
    refresh: () => post<{ token: string }>('/api/auth/refresh'),

    /** 获取当前用户信息 */
    me: () => get<User>('/api/auth/me'),
  }

  // ============ Agent 相关 API ============

  const agents = {
    /** 获取 Agent 列表 */
    list: (params?: PaginationParams & { status?: AgentStatus; type?: string }) => 
      get<PaginatedResponse<Agent>>('/api/agents', { 
        headers: params ? { 'X-Query-Params': JSON.stringify(params) } : undefined 
      }),

    /** 获取所有 Agent（不分页） */
    getAll: (filters?: { status?: AgentStatus; type?: string }) => 
      get<Agent[]>('/api/agents/all', { 
        headers: filters ? { 'X-Query-Params': JSON.stringify(filters) } : undefined 
      }),

    /** 创建 Agent */
    create: (params: CreateAgentParams) => 
      post<Agent>('/api/agents', params),

    /** 获取 Agent 详情 */
    get: (id: string) => 
      get<Agent>(`/api/agents/${id}`),

    /** 更新 Agent */
    update: (id: string, params: UpdateAgentParams) => 
      patch<Agent>(`/api/agents/${id}`, params),

    /** 删除 Agent */
    delete: (id: string) => 
      del<void>(`/api/agents/${id}`),

    /** 启动 Agent */
    start: (id: string) => 
      post<Agent>(`/api/agents/${id}/start`),

    /** 停止 Agent */
    stop: (id: string) => 
      post<Agent>(`/api/agents/${id}/stop`),

    /** 暂停 Agent */
    pause: (id: string) => 
      post<Agent>(`/api/agents/${id}/pause`),

    /** 恢复 Agent */
    resume: (id: string) => 
      post<Agent>(`/api/agents/${id}/resume`),

    /** 获取 Agent 日志 */
    getLogs: (id: string, params?: PaginationParams & { level?: string; startTime?: string; endTime?: string }) => 
      get<PaginatedResponse<AgentLog>>(`/api/agents/${id}/logs`, { 
        headers: params ? { 'X-Query-Params': JSON.stringify(params) } : undefined 
      }),
  }

  // ============ 任务相关 API ============

  const tasks = {
    /** 获取任务列表 */
    list: (params?: PaginationParams & { status?: TaskStatus; agentId?: string; priority?: string }) => 
      get<PaginatedResponse<Task>>('/api/tasks', { 
        headers: params ? { 'X-Query-Params': JSON.stringify(params) } : undefined 
      }),

    /** 获取所有任务（不分页） */
    getAll: (filters?: { status?: TaskStatus; agentId?: string }) => 
      get<Task[]>('/api/tasks/all', { 
        headers: filters ? { 'X-Query-Params': JSON.stringify(filters) } : undefined 
      }),

    /** 创建任务 */
    create: (params: CreateTaskParams) => 
      post<Task>('/api/tasks', params),

    /** 获取任务详情 */
    get: (id: string) => 
      get<Task>(`/api/tasks/${id}`),

    /** 更新任务 */
    update: (id: string, params: UpdateTaskParams) => 
      patch<Task>(`/api/tasks/${id}`, params),

    /** 删除任务 */
    delete: (id: string) => 
      del<void>(`/api/tasks/${id}`),
  }

  // ============ 聊天相关 API ============

  const chat = {
    /** 创建会话 */
    createSession: (data: { projectId?: string; title?: string }) =>
      post<{ id: string; title: string; projectId?: string; createdAt: string }>('/api/chat/sessions', data, { silent: true }),

    /** 获取会话列表 */
    listSessions: () =>
      get<{ items: Array<{ id: string; title: string; projectId?: string; createdAt: string; updatedAt: string }>; total: number }>('/api/chat/sessions', { silent: true }),

    /** 获取会话详情 */
    getSession: (id: string) =>
      get<{ id: string; title: string; projectId?: string; createdAt: string; updatedAt: string }>(`/api/chat/sessions/${id}`, { silent: true }),

    /** 发送消息 */
    sendMessage: (sessionId: string, data: { content: string }) =>
      post<{
        message: { id: string; role: string; content: string; timestamp: string };
        intent: string;
        tasks: Array<{ ticketId: string; workerRole: string; status: string }>;
      }>(`/api/chat/sessions/${sessionId}/messages`, data, { silent: true }),

    /** 获取消息列表 */
    getMessages: (sessionId: string, page?: number, pageSize?: number) =>
      get<{
        messages: Array<{ id: string; role: string; content: string; timestamp: string; metadata?: any }>;
        total: number;
        page: number;
        pageSize: number;
      }>(`/api/chat/sessions/${sessionId}/messages?page=${page || 1}&pageSize=${pageSize || 50}`, { silent: true }),

    /** 执行任务 */
    executeTask: (sessionId: string, data: { content: string }) =>
      post<{ intent: string; tasks: Array<{ ticketId: string; workerRole: string; status: string }> }>(`/api/chat/sessions/${sessionId}/execute`, data, { silent: true }),

    /** 获取任务列表 */
    getTasks: (sessionId: string) =>
      get<{ tasks: Array<any>; total: number }>(`/api/chat/sessions/${sessionId}/tasks`, { silent: true }),

    /** 获取进度 */
    getProgress: (sessionId: string) =>
      get<any>(`/api/chat/sessions/${sessionId}/progress`, { silent: true }),
  }

  // ============ 代码相关 API ============

  const code = {
    /** 获取文件列表 */
    getFiles: (path: string = '') => 
      get<FileInfo[]>(`/api/code/files${path ? '?path=' + encodeURIComponent(path) : ''}`),

    /** 获取文件内容 */
    getFile: (path: string) => 
      get<FileContent>(`/api/code/files/${encodeURIComponent(path)}`),

    /** 更新文件 */
    updateFile: (path: string, params: UpdateFileParams) => 
      put<FileContent>(`/api/code/files/${encodeURIComponent(path)}`, params),

    /** 创建文件/目录 */
    create: (path: string, isDirectory: boolean = false) => 
      post<FileInfo>(`/api/code/files/${encodeURIComponent(path)}`, { isDirectory }),

    /** 删除文件/目录 */
    delete: (path: string) => 
      del<void>(`/api/code/files/${encodeURIComponent(path)}`),

    /** 重命名/移动文件 */
    move: (fromPath: string, toPath: string) => 
      patch<void>(`/api/code/files/${encodeURIComponent(fromPath)}/move`, { toPath }),
  }

  // ============ 导出 ============

  return {
    // 基础请求方法
    request,
    get,
    post,
    put,
    patch,
    del,

    // 业务 API
    auth,
    agents,
    tasks,
    code,
    chat,

    // 配置
    baseUrl,
  }
}

// ============ 辅助 Hook ============

/**
 * 使用带加载状态的 API 请求
 * 
 * 示例:
 * const { data, loading, error, execute } = useApiRequest(() => api.agents.list())
 */
export function useApiRequest<T = any>(
  apiFn: () => Promise<ApiResponse<T>>
) {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  const execute = async (): Promise<ApiResponse<T>> => {
    loading.value = true
    error.value = null

    try {
      const response = await apiFn()
      
      if (response.success) {
        data.value = response.data
      } else {
        error.value = response.error
      }

      return response
    } catch (e: any) {
      const apiError: ApiError = {
        code: 'EXECUTION_ERROR',
        message: e.message || '执行请求时发生错误',
      }
      error.value = apiError
      
      return {
        success: false,
        data: null,
        error: apiError,
        message: apiError.message,
      }
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    execute,
  }
}

/**
 * 创建 API 实例（用于非 setup 环境）
 */
export const createApi = useApi
