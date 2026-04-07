// AgentHive Shared Types

// Auth Types
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// Chat Types
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
}

// Project Types
export interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

// API Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Format Types
export type DateFormat = 'short' | 'long' | 'relative'
