/**
 * API 通用类型定义
 */

/** API 错误信息 */
export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

/** API 统一响应格式 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError | string
  message?: string
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

/** 请求配置选项 */
export interface RequestOptions {
  headers?: Record<string, string>
  skipAuth?: boolean
  timeout?: number
}

/** API 异常类 */
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

/** 列表查询参数 */
export interface ListQueryParams extends PaginationParams {
  search?: string
  filters?: Record<string, unknown>
}

/** 批量操作参数 */
export interface BatchOperationParams {
  ids: string[]
}

/** 批量操作结果 */
export interface BatchOperationResult {
  success: string[]
  failed: Array<{
    id: string
    error: string
  }>
}
