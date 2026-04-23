// 文件列表 API - 代理到后端真实服务
import { proxyToApi } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/code/files')

  // 格式转换: 后端返回 { data: { files, total, path } }，前端期望 { data: [...] } (FileInfo 数组)
  if (result.success && result.data?.files !== undefined) {
    return {
      success: true,
      data: result.data.files,
    }
  }

  return result
})
