import { localStorageApi } from './localStorage'

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    username: string
    email: string
    role: string
  }
}

// Auth API - 使用 LocalStorage
export const authApi = localStorageApi.auth
