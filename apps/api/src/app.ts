import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { requestLogger } from './middleware/request-logger.js'
import { corsConfig } from './config/cors.js'
import { authMiddleware } from './middleware/auth.js'
import { rateLimitMiddleware } from './middleware/rateLimit.js'
import { trafficTracker, hostedSiteMockHandler } from './middleware/traffic.js'
import routes from './routes/index.js'
import logger from './utils/logger.js'
import { startBatchReporter } from './project/traffic-service.js'

const app = express()

// 中间件
app.use(cors(corsConfig))
app.use(express.json())
app.use(cookieParser())

// 请求日志（结构化，含 trace_id）
app.use(requestLogger())

// 认证中间件
app.use(authMiddleware)

// 速率限制（认证之后，路由之前）
app.use(rateLimitMiddleware)

// Hosted sites (public, traffic tracked before auth)
app.use('/h/:projectId', trafficTracker(), hostedSiteMockHandler())

// API 路由
app.use('/api', routes)

// Start background traffic reporter
startBatchReporter()

// 404 处理
app.use((_req, res) => {
  res.status(404).json({
    code: 404,
    message: 'API 不存在',
    data: null,
  })
})

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled server error', err)
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null,
  })
})

export default app
