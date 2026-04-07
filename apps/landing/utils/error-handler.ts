/**
 * 统一错误处理模块
 * 提供错误类型定义、API错误处理、错误消息显示等功能
 */

import { ElMessage, ElNotification } from 'element-plus'
import type { App } from 'vue'

// ==================== 类型定义 ====================

/**
 * 错误码枚举
 */
export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CANCELLED_ERROR = 'CANCELLED_ERROR',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly severity: ErrorSeverity
  public readonly statusCode?: number
  public readonly details?: Record<string, any>
  public readonly timestamp: Date

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    statusCode?: number,
    details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.severity = severity
    this.statusCode = statusCode
    this.details = details
    this.timestamp = new Date()
    
    // 保持堆栈跟踪
    // V8 引擎特有的 stack trace 捕获
    if ('captureStackTrace' in Error) {
      (Error as any).captureStackTrace(this, AppError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    }
  }
}

/**
 * API错误响应接口
 */
export interface ApiErrorResponse {
  code?: string
  message?: string
  errors?: Record<string, string[]>
  details?: Record<string, any>
}

// ==================== 错误消息映射 ====================

/**
 * 错误码对应的用户友好消息
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络后重试',
  [ErrorCode.UNAUTHORIZED]: '登录已过期，请重新登录',
  [ErrorCode.FORBIDDEN]: '您没有权限执行此操作',
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.VALIDATION_ERROR]: '输入数据验证失败，请检查表单',
  [ErrorCode.SERVER_ERROR]: '服务器内部错误，请稍后重试',
  [ErrorCode.UNKNOWN_ERROR]: '发生未知错误，请稍后重试',
  [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
  [ErrorCode.CANCELLED_ERROR]: '请求已取消',
}

/**
 * HTTP状态码到错误码的映射
 */
const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  408: ErrorCode.TIMEOUT_ERROR,
  409: ErrorCode.VALIDATION_ERROR,
  422: ErrorCode.VALIDATION_ERROR,
  500: ErrorCode.SERVER_ERROR,
  502: ErrorCode.SERVER_ERROR,
  503: ErrorCode.SERVER_ERROR,
  504: ErrorCode.TIMEOUT_ERROR,
}

// ==================== 核心函数 ====================

/**
 * 将任意错误转换为 AppError
 * @param error - 原始错误
 * @returns AppError 实例
 */
export function toAppError(error: any): AppError {
  // 如果已经是 AppError，直接返回
  if (error instanceof AppError) {
    return error
  }

  // 处理网络错误
  if (!navigator.onLine || error?.message?.includes('network')) {
    return new AppError(
      ERROR_MESSAGES[ErrorCode.NETWORK_ERROR],
      ErrorCode.NETWORK_ERROR,
      ErrorSeverity.ERROR
    )
  }

  // 处理超时错误
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return new AppError(
      ERROR_MESSAGES[ErrorCode.TIMEOUT_ERROR],
      ErrorCode.TIMEOUT_ERROR,
      ErrorSeverity.WARNING
    )
  }

  // 处理取消错误
  if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
    return new AppError(
      ERROR_MESSAGES[ErrorCode.CANCELLED_ERROR],
      ErrorCode.CANCELLED_ERROR,
      ErrorSeverity.INFO
    )
  }

  // 处理 HTTP 错误响应
  if (error?.response) {
    const { status, data } = error.response
    const errorCode = HTTP_STATUS_TO_ERROR_CODE[status] || ErrorCode.UNKNOWN_ERROR
    
    return new AppError(
      data?.message || ERROR_MESSAGES[errorCode],
      errorCode,
      status >= 500 ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
      status,
      data?.errors || data?.details
    )
  }

  // 默认处理
  return new AppError(
    error?.message || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR],
    ErrorCode.UNKNOWN_ERROR,
    ErrorSeverity.ERROR
  )
}

/**
 * 统一处理 API 错误
 * @param error - 错误对象
 * @param options - 处理选项
 */
export function handleApiError(
  error: any,
  options: {
    showMessage?: boolean
    redirectOnAuth?: boolean
    onError?: (error: AppError) => void
  } = {}
): AppError {
  const { showMessage = true, redirectOnAuth = true, onError } = options

  const appError = toAppError(error)

  // 执行自定义错误处理回调
  if (onError) {
    onError(appError)
  }

  // 处理认证错误
  if (appError.code === ErrorCode.UNAUTHORIZED && redirectOnAuth) {
    const router = useRouter()
    const currentPath = useRoute().fullPath
    
    // 如果已经在登录页，不重定向
    if (currentPath === '/login' || currentPath.startsWith('/login?')) {
      if (showMessage) {
        showErrorMessage('登录已过期，请重新登录')
      }
      return appError
    }
    
    // 显示消息
    if (showMessage) {
      showErrorMessage(appError.message)
    }
    
    // 延迟跳转，让用户看到提示
    setTimeout(() => {
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
    }, 1500)
    
    return appError
  }

  // 处理权限错误
  if (appError.code === ErrorCode.FORBIDDEN) {
    if (showMessage) {
      ElNotification.error({
        title: '权限不足',
        message: appError.message,
        duration: 5000,
      })
    }
    return appError
  }

  // 处理验证错误（显示详细字段错误）
  if (appError.code === ErrorCode.VALIDATION_ERROR && appError.details) {
    const fieldErrors = Object.entries(appError.details)
      .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
      .join('\n')
    
    if (showMessage) {
      ElNotification.error({
        title: '表单验证失败',
        message: fieldErrors || appError.message,
        duration: 5000,
      })
    }
    return appError
  }

  // 服务器错误（更严重）
  if (appError.code === ErrorCode.SERVER_ERROR) {
    if (showMessage) {
      ElNotification.error({
        title: '服务器错误',
        message: appError.message,
        duration: 6000,
      })
    }
    return appError
  }

  // 默认显示错误消息
  if (showMessage) {
    showErrorMessage(appError.message)
  }

  // 开发环境打印详细错误
  if (import.meta.dev) {
    console.error('[API Error]', appError.toJSON())
  }

  return appError
}

/**
 * 显示错误提示消息
 * @param message - 错误消息
 * @param options - 消息选项
 */
export function showErrorMessage(
  message: string,
  options: {
    duration?: number
    showClose?: boolean
    grouping?: boolean
  } = {}
): void {
  const { duration = 4000, showClose = true, grouping = true } = options

  ElMessage.error({
    message,
    duration,
    showClose,
    grouping,
  })
}

/**
 * 显示成功提示消息
 * @param message - 成功消息
 * @param options - 消息选项
 */
export function showSuccessMessage(
  message: string,
  options: {
    duration?: number
    showClose?: boolean
  } = {}
): void {
  const { duration = 3000, showClose = true } = options

  ElMessage.success({
    message,
    duration,
    showClose,
  })
}

/**
 * 显示警告提示消息
 * @param message - 警告消息
 * @param options - 消息选项
 */
export function showWarningMessage(
  message: string,
  options: {
    duration?: number
    showClose?: boolean
  } = {}
): void {
  const { duration = 4000, showClose = true } = options

  ElMessage.warning({
    message,
    duration,
    showClose,
  })
}

/**
 * 显示通知
 * @param type - 通知类型
 * @param title - 标题
 * @param message - 消息内容
 * @param options - 选项
 */
export function showNotification(
  type: 'success' | 'warning' | 'info' | 'error',
  title: string,
  message: string,
  options: {
    duration?: number
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  } = {}
): void {
  const { duration = 4500, position = 'top-right' } = options

  ElNotification[type]({
    title,
    message,
    duration,
    position,
  })
}

// ==================== 错误边界相关 ====================

/**
 * 错误边界状态接口
 */
export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

/**
 * 错误处理器函数类型
 */
export type ErrorHandler = (error: Error, errorInfo?: any) => void

/**
 * 创建默认错误处理器
 * @param callback - 错误回调
 * @returns 错误处理器函数
 */
export function createErrorHandler(callback?: ErrorHandler): ErrorHandler {
  return (error: Error, errorInfo?: any) => {
    // 记录错误
    console.error('[ErrorBoundary]', error, errorInfo)

    // 在开发环境显示详细信息
    if (import.meta.dev) {
      console.group('🔴 ErrorBoundary 捕获到错误')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Stack:', error.stack)
      console.groupEnd()
    }

    // 执行回调
    if (callback) {
      callback(error, errorInfo)
    }

    // 上报错误（生产环境）
    if (import.meta.env.PROD && typeof window !== 'undefined') {
      reportError(error, errorInfo)
    }
  }
}

/**
 * 上报错误到监控服务
 * @param error - 错误对象
 * @param errorInfo - 错误信息
 */
function reportError(error: Error, errorInfo?: any): void {
  // TODO: 集成实际错误监控服务（如 Sentry、LogRocket 等）
  const errorData = {
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    errorInfo,
  }

  // 可以发送到后端日志接口
  // fetch('/api/log/error', { method: 'POST', body: JSON.stringify(errorData) })
  
  console.debug('[Error Report]', errorData)
}

// ==================== 辅助工具 ====================

/**
 * 包装异步函数，自动处理错误
 * @param fn - 异步函数
 * @param errorHandler - 错误处理器
 * @returns 包装后的函数
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: AppError) => void
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    try {
      return await fn(...args)
    } catch (error) {
      const appError = handleApiError(error, { onError: errorHandler })
      return undefined
    }
  }
}

/**
 * 安全执行函数，捕获错误但不中断程序
 * @param fn - 要执行的函数
 * @param fallback - 错误时的返回值
 * @returns 执行结果或 fallback
 */
export function safeExecute<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (error) {
    console.error('[safeExecute] 执行出错:', error)
    return fallback
  }
}

/**
 * 创建 API 调用包装器
 * @param apiFn - API 函数
 * @returns 包装后的 API 函数
 */
export function createApiWrapper<T extends (...args: any[]) => Promise<any>>(
  apiFn: T
): (...args: Parameters<T>) => Promise<{ data?: ReturnType<T> extends Promise<infer R> ? R : never; error?: AppError }> {
  return async (...args: Parameters<T>) => {
    try {
      const data = await apiFn(...args)
      return { data }
    } catch (error) {
      const appError = handleApiError(error, { showMessage: false })
      return { error: appError }
    }
  }
}

// ==================== Vue 插件 ====================

/**
 * 错误处理插件安装函数
 * @param app - Vue 应用实例
 */
export function installErrorHandler(app: App): void {
  // 全局属性
  app.config.globalProperties.$handleError = handleApiError
  app.config.globalProperties.$showError = showErrorMessage
  app.config.globalProperties.$showSuccess = showSuccessMessage
  
  // 全局错误处理器
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue Error]', err)
    // 安全访问，instance 可能为 null
    if (instance) {
      console.error('[Vue Component]', instance)
    }
    console.error('[Vue Info]', info)
    
    if (err instanceof Error) {
      showErrorMessage(`组件渲染错误: ${err.message}`)
    }
  }
  
  // 警告处理器
  app.config.warnHandler = (msg, instance, trace) => {
    console.warn('[Vue Warning]', msg)
    if (import.meta.dev && instance) {
      console.warn('[Vue Component]', instance)
      console.warn('[Vue Trace]', trace)
    }
  }
}

export default {
  install: installErrorHandler,
}
