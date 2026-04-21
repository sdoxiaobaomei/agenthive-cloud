// WebSocket Hub - Socket.io 实时通信
import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { AI_ATTRIBUTES, AI_SPAN_NAMES, extractTraceContextFromPayload } from '@agenthive/observability'
import { redisCache } from '../services/redis-cache.js'
import { jwt } from '../utils/jwt.js'

// 访客房间管理
const visitorRooms = new Map<string, { joinedAt: number; socketId: string }>()
const VISITOR_TIMEOUT = 1000 * 60 * 10 // 10 分钟

// Socket.io 实例
let io: SocketIOServer | null = null

// 初始化 WebSocket
export function initWebSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  // 中间件：身份验证 + Trace Context 提取
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token
      
      // 从 HTTP handshake headers 提取 traceparent
      const traceparent = socket.handshake.headers['traceparent'] as string | undefined
      if (traceparent) {
        socket.data.traceContext = { traceparent }
      }
      
      if (!token) {
        // 访客模式
        socket.data.isVisitor = true
        socket.data.userId = `visitor-${socket.id}`
        return next()
      }
      
      // 验证 Token
      const payload = jwt.verify(token)
      if (!payload) {
        return next(new Error('Invalid token'))
      }
      
      // 检查会话是否在 Redis 中
      const session = await redisCache.getSession(token)
      if (!session) {
        return next(new Error('Session expired'))
      }
      
      socket.data.isVisitor = false
      socket.data.userId = payload.userId
      socket.data.username = payload.username
      socket.data.token = token
      
      next()
    } catch (error) {
      next(new Error('Authentication error'))
    }
  })

  // 连接处理
  io.on('connection', (socket: Socket) => {
    const isVisitor = socket.data.isVisitor
    const userId = socket.data.userId
    
    console.log(`[WebSocket] ${isVisitor ? 'Visitor' : 'User'} connected: ${userId}`)
    
    if (isVisitor) {
      handleVisitorConnection(socket)
    } else {
      handleAuthenticatedConnection(socket)
    }
    
    // 通用事件处理
    setupCommonHandlers(socket)
  })

  console.log('[WebSocket] Server initialized')
  return io
}

// 访客连接处理
function handleVisitorConnection(socket: Socket) {
  const socketId = socket.id
  
  visitorRooms.set(socketId, { joinedAt: Date.now(), socketId })
  socket.join('visitors')
  socket.join('demo-broadcast')
  
  socket.emit('mode', 'visitor')
  socket.emit('connected', { 
    visitorId: socket.data.userId,
    message: 'Connected as visitor (read-only)',
  })
  
  // 访客只能查看演示数据，不能发送命令
  socket.on('command', () => {
    socket.emit('error', { message: 'Please sign in to send commands' })
  })
  
  // 超时自动断开
  setTimeout(() => {
    if (visitorRooms.has(socketId)) {
      socket.disconnect(true)
    }
  }, VISITOR_TIMEOUT)
}

// 认证用户连接处理
function handleAuthenticatedConnection(socket: Socket) {
  const userId = socket.data.userId
  const username = socket.data.username
  
  // 加入用户专属房间
  socket.join(`user:${userId}`)
  socket.join('authenticated')
  
  socket.emit('mode', 'authenticated')
  socket.emit('connected', { 
    userId,
    username,
    message: `Welcome back, ${username}!`,
  })
  
  // Agent 相关事件
  setupAgentHandlers(socket)
  
  // 任务相关事件
  setupTaskHandlers(socket)
  
  // 终端相关事件
  setupTerminalHandlers(socket)
}

// Agent 事件处理
function setupAgentHandlers(socket: Socket) {
  // 订阅 Agent 状态更新
  socket.on('agent:subscribe', async (agentId: string) => {
    socket.join(`agent:${agentId}`)
    
    // 获取当前状态
    const status = await redisCache.getAgentStatus(agentId)
    socket.emit('agent:status', { agentId, ...status })
    
    console.log(`[WebSocket] User ${socket.data.userId} subscribed to agent ${agentId}`)
  })
  
  // 取消订阅 Agent
  socket.on('agent:unsubscribe', (agentId: string) => {
    socket.leave(`agent:${agentId}`)
    console.log(`[WebSocket] User ${socket.data.userId} unsubscribed from agent ${agentId}`)
  })
  
  // Agent 心跳（由 Agent 服务发送）
  socket.on('agent:heartbeat', async (data: { agentId: string; status: string; metadata?: Record<string, unknown> }) => {
    const { agentId, status, metadata } = data
    const tracer = trace.getTracer('agenthive-api-websocket')
    const span = tracer.startSpan(AI_SPAN_NAMES.WS_HEARTBEAT, {
      attributes: {
        [AI_ATTRIBUTES.AGENT_ID]: agentId,
        [AI_ATTRIBUTES.AGENT_STATUS]: status,
        [AI_ATTRIBUTES.WS_CONNECTION_ID]: socket.id,
      },
    })

    try {
      // 更新 Redis 中的状态
      await redisCache.setAgentStatus(agentId, status, metadata)
      await redisCache.updateAgentHeartbeat(agentId)
      
      // 广播给所有订阅者
      io?.to(`agent:${agentId}`).emit('agent:status', {
        agentId,
        status,
        metadata,
        timestamp: Date.now(),
      })
      span.setStatus({ code: SpanStatusCode.OK })
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
    } finally {
      span.end()
    }
  })
  
  // 发送命令给 Agent
  socket.on('agent:command', async (data: { agentId: string; command: string; payload?: unknown }) => {
    const { agentId, command, payload } = data
    
    // 检查 Agent 是否在线
    const isOnline = await redisCache.isAgentOnline(agentId)
    if (!isOnline) {
      socket.emit('agent:error', { agentId, message: 'Agent is offline' })
      return
    }
    
    // 广播命令给 Agent
    io?.to(`agent:${agentId}`).emit('agent:command', {
      command,
      payload,
      from: socket.data.userId,
      timestamp: Date.now(),
    })
    
    socket.emit('agent:command:sent', { agentId, command })
  })
}

// 任务事件处理
function setupTaskHandlers(socket: Socket) {
  // 订阅任务进度
  socket.on('task:subscribe', async (taskId: string) => {
    socket.join(`task:${taskId}`)
    
    // 获取当前进度
    const progress = await redisCache.getTaskProgress(taskId)
    socket.emit('task:progress', { taskId, ...progress })
    
    console.log(`[WebSocket] User ${socket.data.userId} subscribed to task ${taskId}`)
  })
  
  // 取消订阅任务
  socket.on('task:unsubscribe', (taskId: string) => {
    socket.leave(`task:${taskId}`)
  })
  
  // 更新任务进度（由 Agent 服务发送）
  socket.on('task:progress', async (data: { taskId: string; progress: number; metadata?: Record<string, unknown> }) => {
    const { taskId, progress, metadata } = data
    
    // 更新 Redis
    await redisCache.setTaskProgress(taskId, progress, metadata)
    
    // 广播给所有订阅者
    io?.to(`task:${taskId}`).emit('task:progress', {
      taskId,
      progress,
      metadata,
      timestamp: Date.now(),
    })
  })
  
  // 任务日志
  socket.on('task:log', async (data: { taskId: string; log: string; level?: string }) => {
    const { taskId, log, level = 'info' } = data
    
    // 添加到 Redis 日志列表
    await redisCache.addLog(taskId, `[${level.toUpperCase()}] ${log}`)
    
    // 广播给订阅者
    io?.to(`task:${taskId}`).emit('task:log', {
      taskId,
      log,
      level,
      timestamp: Date.now(),
    })
  })
}

// 终端事件处理
function setupTerminalHandlers(socket: Socket) {
  // 订阅终端输出
  socket.on('terminal:subscribe', (agentId: string) => {
    socket.join(`terminal:${agentId}`)
    console.log(`[WebSocket] User ${socket.data.userId} subscribed to terminal ${agentId}`)
  })
  
  // 发送终端命令
  socket.on('terminal:input', (data: { agentId: string; input: string }) => {
    const { agentId, input } = data
    
    io?.to(`agent:${agentId}`).emit('terminal:input', {
      input,
      from: socket.data.userId,
      timestamp: Date.now(),
    })
  })
  
  // 终端输出（由 Agent 发送）
  socket.on('terminal:output', (data: { agentId: string; output: string }) => {
    const { agentId, output } = data
    
    io?.to(`terminal:${agentId}`).emit('terminal:output', {
      output,
      timestamp: Date.now(),
    })
  })
}

// 通用事件处理
function setupCommonHandlers(socket: Socket) {
  // 断开连接
  socket.on('disconnect', (reason) => {
    console.log(`[WebSocket] Disconnected: ${socket.data.userId}, reason: ${reason}`)
    
    if (socket.data.isVisitor) {
      visitorRooms.delete(socket.id)
    }
  })
  
  // 错误处理
  socket.on('error', (error) => {
    console.error(`[WebSocket] Error from ${socket.data.userId}:`, error)
  })
  
  // Ping/Pong 用于保持连接
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() })
  })
}

// 广播函数（供其他模块调用）
export const broadcast = {
  // 广播 Agent 状态变化
  agentStatus: (agentId: string, status: string, metadata?: Record<string, unknown>) => {
    io?.to(`agent:${agentId}`).emit('agent:status', {
      agentId,
      status,
      metadata,
      timestamp: Date.now(),
    })
  },
  
  // 广播任务进度
  taskProgress: (taskId: string, progress: number, metadata?: Record<string, unknown>) => {
    io?.to(`task:${taskId}`).emit('task:progress', {
      taskId,
      progress,
      metadata,
      timestamp: Date.now(),
    })
  },
  
  // 广播日志
  log: (agentId: string, log: string, level: string = 'info') => {
    io?.to(`agent:${agentId}`).emit('agent:log', {
      agentId,
      log,
      level,
      timestamp: Date.now(),
    })
  },
  
  // 广播给所有认证用户
  toAll: (event: string, data: unknown) => {
    io?.to('authenticated').emit(event, data)
  },
  
  // 广播给访客
  toVisitors: (event: string, data: unknown) => {
    io?.to('visitors').emit(event, data)
  },
  
  // 广播给所有人
  toAllUsers: (event: string, data: unknown) => {
    io?.emit(event, data)
  },
}

// 获取在线统计
export const getStats = async () => {
  if (!io) return { total: 0, authenticated: 0, visitors: 0 }
  
  const sockets = await io.fetchSockets()
  const authenticated = sockets.filter(s => !s.data.isVisitor).length
  const visitors = sockets.filter(s => s.data.isVisitor).length
  
  return {
    total: sockets.length,
    authenticated,
    visitors,
  }
}

export default { initWebSocket, broadcast, getStats }
