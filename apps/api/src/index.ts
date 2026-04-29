// API 服务器入口
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })
import './telemetry.js' // OpenTelemetry 必须在其他 import 之前初始化
import { createServer } from 'http'
import { mkdir } from 'fs/promises'
import app from './app.js'
import { testConnection, pool } from './config/database.js'
import { testRedisConnection } from './config/redis.js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initWebSocket, getStats } from './websocket/hub.js'
import { initLLM } from './services/llm.js'
import { initializeTaskExecution } from './services/taskExecution.js'
import { initTaskQueue } from './services/taskQueue.js'
import { BillingRetryWorker } from './services/billingRetry.js'
import logger from './utils/logger.js'
import { WORKSPACE_BASE } from './config/workspace.js'

const PORT = process.env.PORT || 3001

const __dirname = dirname(fileURLToPath(import.meta.url))

// 自动初始化数据库表（如果表不存在）
async function initDatabaseSchema(): Promise<void> {
  try {
    await pool.query('SELECT 1 FROM projects LIMIT 1')
  } catch (err: any) {
    if (err.code === '42P01') {
      logger.info('[Database] Tables not found, running schema initialization...')
      try {
        const schemaPath = resolve(__dirname, './db/schema.sql')
        const schema = readFileSync(schemaPath, 'utf-8')
        const statements = schema
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'))

        for (const stmt of statements) {
          try {
            await pool.query(stmt)
          } catch (e: any) {
            if (e.code !== '42P07' && !e.message?.includes('already exists')) {
              logger.warn('[Database] Schema init warning', { message: e.message })
            }
          }
        }
        logger.info('[Database] Schema initialization complete.')
      } catch (readErr) {
        logger.error('[Database] Failed to read schema file', readErr as Error)
      }
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
    // 自动初始化数据库表（如果不存在）
    await initDatabaseSchema()
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
