import { localStorageApi } from './localStorage'
import type { CodeFile } from '@/types'

export interface FileListResponse {
  files: CodeFile[]
  total: number
}

export interface FileContentResponse {
  path: string
  content: string
  language: string
  lastModified: string
}

// Code API - 使用 LocalStorage
export const codeApi = localStorageApi.code
