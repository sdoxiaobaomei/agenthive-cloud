// 移动/重命名文件 API - 代理到后端
// 前端: POST /api/code/files/move  body: { projectId, sourcePath, targetPath }
// 后端: POST /api/code/workspace/files/move  body: { projectId, sourcePath, targetPath }
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = await proxyToApi(event, '/api/code/workspace/files/move', {
    method: 'POST',
    body,
  })
  return result
})
