// API 服务器入口
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })
import './telemetry.js' // OpenTelemetry 必须在其他 import 之前初始化
import { createServer } from 'http'
import { mkdir } from 'fs/promises'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import app from './app.js'
import { testConnection } from './config/database.js'
import { testRedisConnection } from './config/redis.js'
import { initWebSocket, getStats } from './websocket/hub.js'
import { initLLM } from './services/llm.js'
import { initializeTaskExecution } from './services/taskExecution.js'
import { initTaskQueue } from './services/taskQueue.js'
import { BillingRetryWorker } from './services/billingRetry.js'
import logger from './utils/logger.js'
import { WORKSPACE_BASE } from './config/workspace.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_ROOT = resolve(__dirname, '..') // 确保 cwd 指向 apps/api

const PORT = process.env.PORT || 3001

/**
 * 运行数据库 migration（Migration-Only 策略）
 * - 开发环境：启动时自动执行 pending migration
 * - 生产环境：应在 CI/CD 中显式执行，此处仅做兜底
 */
async function runMigrations(): Promise<void> {
  try {
    logger.info('[Database] Running pending migrations...')
    execSync('npm run migrate:up', {
      cwd: API_ROOT,
      stdio: 'inherit',
      env: process.env,
    })
    logger.info('[Database] Migrations applied successfully')
  } catch (err) {
    logger.error('[Database] Migration failed', err as Error)
    // 生产环境 migration 失败应终止启动；开发环境允许继续排查
    if (process.env.NODE_ENV === 'production') {
      throw err
    }
  }
}

// 测试数据库和 Redis 连接并启动服务器
const startServer = async () => {
  // 测试数据库连接
  const dbConnected = await testConnection()
  if (!dbConnected) {
    logger.error('[Server] Failed to connect to database. Starting with limited functionality...')
  } else {
    // 自动运行数据库 migration（替代旧 initDatabaseSchema）
    await runMigrations()
  }

  // 测试 Redis 连接
  const redisConnected = await testRedisConnection()
  if (!redisConnected) {
    logger.error('[Server] Failed to connect to Redis. Starting with limited functionality...')
  }

  // 初始化 LLM 服务
  try {
    await initLLM()
  } catch (error) {
    logger.error('[Server] LLM Service initialization failed', error as Error)
    logger.info('[Server] Continuing without LLM support...')
  }

  // 创建工作区目录
  try {
    await mkdir(WORKSPACE_BASE, { recursive: true })
    logger.info('[Server] Workspace directory ready', { workspaceBase: WORKSPACE_BASE })
  } catch (error) {
    logger.error('[Server] Failed to create workspace directory', error as Error)
  }

  // 初始化任务队列（Redis Stream）
  try {
    await initTaskQueue()
    logger.info('[Server] Task Queue initialized')
  } catch (error) {
    logger.error('[Server] Task Queue initialization failed', error as Error)
  }

  // 初始化计费重试 Worker
  let billingWorker: BillingRetryWorker | null = null
  try {
    billingWorker = new BillingRetryWorker()
    await billingWorker.start(30000)
    logger.info('[Server] Billing Retry Worker initialized')
  } catch (error) {
    logger.error('[Server] Billing Retry Worker initialization failed', error as Error)
  }

  // 初始化任务执行服务
  try {
    initializeTaskExecution({
      workspaceBasePath: WORKSPACE_BASE,
      maxIterations: 50,
      maxConcurrentTasks: 3,
      timeoutMs: 10 * 60 * 1000, // 10 minutes
    })
    logger.info('[Server] Task Execution Service initialized')
  } catch (error) {
    logger.error('[Server] Task Execution Service initialization failed', error as Error)
  }

  // 创建 HTTP 服务器
  const server = createServer(app)

  // 初始化 WebSocket
  let wsEnabled = false
  if (redisConnected) {
    try {
      initWebSocket(server)
      wsEnabled = true
    } catch (error) {
      logger.error('[Server] WebSocket initialization failed', error as Error)
    }
  }

  // 启动服务器
  server.listen(PORT, () => {
    logger.info('AgentHive API Server started', {
      port: PORT,
      database: dbConnected ? 'Connected' : 'Disconnected',
      redis: redisConnected ? 'Connected' : 'Disconnected',
      websocket: wsEnabled ? 'Enabled' : 'Disabled',
      healthEndpoint: `http://localhost:${PORT}/api/health`,
    })
  })

  // 定期打印连接统计
  if (wsEnabled) {
    setInterval(async () => {
      const stats = await getStats()
      if (stats.total > 0) {
        logger.info('[WebSocket] Connections', { total: stats.total, authenticated: stats.authenticated, visitors: stats.visitors })
      }
    }, 60000) // 每分钟打印一次
  }
}

startServer().catch((err) => {
  logger.error('Server startup failed', err)
  process.exit(1)
})
