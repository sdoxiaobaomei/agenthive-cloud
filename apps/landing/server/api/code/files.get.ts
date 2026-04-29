// 文件列表 API - 代理到后端 /api/code/workspace/files
// 后端响应格式: { code, message, data: { files: [{ name, path, type, size, modifiedAt }], path, workspace } }
// 前端期望格式: { success: true, data: FileInfo[] }
import { proxyToApi } from '../../utils/apiProxy'

interface BackendFileItem {
  name: string
  path: string
  type: 'directory' | 'file'
  size: number
  modifiedAt: string
}

interface BackendFilesResponse {
  code?: number
  message?: string
  data?: {
    files: BackendFileItem[]
    path: string
    workspace: string
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const result = await proxyToApi(event, '/api/code/workspace/files', { query })

  const backend = result as BackendFilesResponse
  if (backend.code === 200 && backend.data?.files !== undefined) {
    return {
      success: true,
      data: backend.data.files,
    }
  }

  // 兼容旧格式
  if (result.success && result.data?.files !== undefined) {
    return {
      success: true,
      data: result.data.files,
    }
  }

  return result
})
