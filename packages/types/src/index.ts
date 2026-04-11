/**
 * @agenthive/types - AgentHive 共享类型包
 * 
 * 前后端通用的类型定义
 */

// 用户相关
export * from './user'

// Agent 相关
export * from './agent'

// 任务相关
export * from './task'

// 代码/文件相关
export * from './code'

// 认证相关
export * from './auth'

// API 通用类型
export * from './api'

// 消息类型
export interface Message {
  id: string
  senderType: 'user' | 'agent' | 'system'
  senderId?: string
  senderName?: string
  senderRole?: import('./agent').AgentRole
  content: string
  contentType: 'text' | 'code' | 'image' | 'file' | 'command'
  language?: string
  metadata?: Record<string, unknown>
  createdAt: string
  taskId?: string
}

// 系统状态
export interface SystemStatus {
  version: string
  uptime: number
  environment: 'development' | 'production' | 'test'
  timestamp: string
}

// WebSocket 事件类型
export type WebSocketEventType =
  | 'agent.status_changed'
  | 'agent.log'
  | 'task.updated'
  | 'task.completed'
  | 'message.received'
  | 'system.notification'

// WebSocket 消息
export interface WebSocketMessage {
  type: WebSocketEventType
  payload: unknown
  timestamp: string
}
