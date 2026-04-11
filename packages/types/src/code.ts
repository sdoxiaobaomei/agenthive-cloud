/**
 * 代码/文件相关类型定义
 */

/** 文件信息 */
export interface FileInfo {
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
  modifiedAt: string
  children?: FileInfo[]
  isDirectory?: boolean
}

/** 文件内容 */
export interface FileContent {
  path: string
  name: string
  content: string
  language: string
  encoding?: string
  lastModified?: string
}

/** 代码文件（兼容旧接口） */
export interface CodeFile {
  path: string
  name: string
  content: string
  language: string
  lastModified: string
  isDirectory?: boolean
}

/** 更新文件参数 */
export interface UpdateFileParams {
  content: string
  encoding?: string
  message?: string
}
