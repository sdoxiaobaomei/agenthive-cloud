import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { requestLogger } from './middleware/request-logger.js'
import { corsConfig } from './config/cors.js'
import { authMiddleware } from './middleware/auth.js'
import routes from './routes/index.js'
import logger from './utils/logger.js'

const app = express()

// 中间件
app.use(cors(corsConfig))
app.use(express.json())
app.use(cookieParser())

// 请求日志（结构化，含 trace_id）
app.use(requestLogger())

// 认证中间件
app.use(authMiddleware)

// API 路由
app.use('/api', routes)

// 404 处理
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API 不存在',
  })
})

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled server error', err)
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  })
})

export default app
