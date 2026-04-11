/**
 * 用户相关类型定义
 */

/** 用户角色 */
export type UserRole = 'admin' | 'user' | 'guest'

/** 用户信息 */
export interface User {
  id: string
  username: string
  name: string
  email?: string
  phone?: string
  role: UserRole | string
  avatar?: string
  createdAt: string
  updatedAt: string
}

/** 用户偏好设置 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  notifications: boolean
}
