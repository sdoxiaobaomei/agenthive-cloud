// API 服务器入口
import './telemetry.js' // OpenTelemetry 必须在其他 import 之前初始化
import { createServer } from 'http'
import { mkdir } from 'fs/promises'
import app from './app.js'
import { testConnection } from './config/database.js'
import { testRedisConnection } from './config/redis.js'
import { initWebSocket, getStats } from './websocket/hub.js'
import { initLLM } from './services/llm.js'
import { initializeTaskExecution } from './services/taskExecution.js'

const PORT = process.env.PORT || 3001
const WORKSPACE_BASE = process.env.WORKSPACE_BASE || '/data/workspaces'

// 测试数据库和 Redis 连接并启动服务器
const startServer = async () => {
  // 测试数据库连接
  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.error('[Server] Failed to connect to database. Starting with limited functionality...')
  }

  // 测试 Redis 连接
  const redisConnected = await testRedisConnection()
  if (!redisConnected) {
    console.error('[Server] Failed to connect to Redis. Starting with limited functionality...')
  }

  // 初始化 LLM 服务
  try {
    await initLLM()
  } catch (error) {
    console.error('[Server] LLM Service initialization failed:', error)
    console.log('[Server] Continuing without LLM support...')
  }

  // 创建工作区目录
  try {
    await mkdir(WORKSPACE_BASE, { recursive: true })
    console.log(`[Server] Workspace directory ready: ${WORKSPACE_BASE}`)
  } catch (error) {
    console.error('[Server] Failed to create workspace directory:', error)
  }

  // 初始化任务执行服务
  try {
    initializeTaskExecution({
      workspaceBasePath: WORKSPACE_BASE,
      maxIterations: 50,
      maxConcurrentTasks: 3,
      timeoutMs: 10 * 60 * 1000, // 10 minutes
    })
    console.log('[Server] Task Execution Service initialized')
  } catch (error) {
    console.error('[Server] Task Execution Service initialization failed:', error)
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
      console.error('[Server] WebSocket initialization failed:', error)
    }
  }

  // 启动服务器
  server.listen(PORT, () => {
    console.log(`
🚀 AgentHive API Server started!

📡 Server: http://localhost:${PORT}
🗄️  Database: ${dbConnected ? 'Connected' : 'Disconnected'}
📦 Redis: ${redisConnected ? 'Connected' : 'Disconnected'}
🔌 WebSocket: ${wsEnabled ? 'Enabled' : 'Disabled'}
📚 API Docs: http://localhost:${PORT}/api/health

Available endpoints:
  - POST /api/auth/sms/send      发送短信验证码
  - POST /api/auth/login/sms     短信验证码登录
  - POST /api/auth/login         用户名密码登录
  - POST /api/auth/register      用户注册
  - POST /api/auth/logout        用户登出
  - POST /api/auth/refresh       刷新 Token
  - GET  /api/auth/me            获取当前用户
  
  - GET  /api/agents             Agent 列表
  - POST /api/agents             创建 Agent
  - GET  /api/agents/:id         Agent 详情
  - PATCH /api/agents/:id        更新 Agent
  - DELETE /api/agents/:id       删除 Agent
  - POST /api/agents/:id/start   启动 Agent
  - POST /api/agents/:id/stop    停止 Agent
  - POST /api/agents/:id/pause   暂停 Agent
  - POST /api/agents/:id/resume  恢复 Agent
  - POST /api/agents/:id/command 发送命令
  - GET  /api/agents/:id/logs    获取日志
  
  - GET  /api/tasks              任务列表
  - POST /api/tasks              创建任务
  - GET  /api/tasks/:id          任务详情
  - PATCH /api/tasks/:id         更新任务
  - DELETE /api/tasks/:id        删除任务
  - POST /api/tasks/:id/execute  执行任务 ⭐ NEW
  - POST /api/tasks/:id/cancel   取消任务
  - GET  /api/tasks/:id/progress 任务进度 ⭐ NEW
  - GET  /api/tasks/:id/subtasks 获取子任务
  
  - GET  /api/code/workspace/files        工作区文件列表 ⭐ NEW
  - GET  /api/code/workspace/files/content 读取工作区文件 ⭐ NEW
  - POST /api/code/workspace/files/save   保存工作区文件 ⭐ NEW
  - DELETE /api/code/workspace/files      删除工作区文件 ⭐ NEW
  
  - GET  /api/code/files         文件列表
  - GET  /api/code/files/*       文件内容
  - PUT  /api/code/files/*       更新文件
  - DELETE /api/code/files/*     删除文件
  - GET  /api/code/search        搜索文件
  - GET  /api/code/recent        最近文件
  
  - GET  /api/demo/plan          示例计划
  - GET  /api/demo/agents        示例 Agents
  - GET  /api/demo/tasks         示例任务
  - GET  /api/demo/visitor-status 访客状态
  
  - GET  /api/health             健康检查

WebSocket Events:
  - agent:subscribe <agentId>    订阅 Agent 状态
  - agent:unsubscribe <agentId>  取消订阅
  - agent:command                发送命令给 Agent
  - task:subscribe <taskId>      订阅任务进度
  - task:progress                更新任务进度
  - task:log                     任务日志
  - terminal:subscribe <agentId> 订阅终端输出
  - terminal:input               发送终端命令
  `)
  })

  // 定期打印连接统计
  if (wsEnabled) {
    setInterval(async () => {
      const stats = await getStats()
      if (stats.total > 0) {
        console.log(`[WebSocket] Connections: ${stats.total} (Auth: ${stats.authenticated}, Visitors: ${stats.visitors})`)
      }
    }, 60000) // 每分钟打印一次
  }
}

startServer().catch(console.error)
