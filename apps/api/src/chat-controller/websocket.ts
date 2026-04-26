/**
 * Chat WebSocket Namespace - /chat
 *
 * Handles real-time progress updates for chat sessions.
 * Integrates with the main Socket.IO server via namespace.
 */

import type { Server as SocketIOServer, Socket } from 'socket.io'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { AI_ATTRIBUTES, AI_SPAN_NAMES } from '@agenthive/observability'
import { redis, redisPub, redisSub, key } from '../config/redis.js'
import logger from '../utils/logger.js'

// 订阅 Redis 频道用于跨进程广播
const CHAT_PROGRESS_CHANNEL = 'chat:progress'

export function initChatNamespace(io: SocketIOServer): void {
  const chatNsp = io.of('/chat')

  chatNsp.use(async (socket: Socket, next) => {
    try {
      // 认证已在主 hub (websocket/hub.ts) 的全局 io.use() 中完成
      // socket.data 已包含 userId（认证用户、dev 模拟用户或访客）
      if (!socket.data.userId) {
        return next(new Error('Authentication required'))
      }
      next()
    } catch (error) {
      next(new Error('Authentication error'))
    }
  })

  chatNsp.on('connection', (socket: Socket) => {
    logger.info('Chat WebSocket connected', { socketId: socket.id })

    // Join session room
    socket.on('session:join', async (sessionId: string) => {
      const tracer = trace.getTracer('agenthive-api-chat')
      const span = tracer.startSpan(AI_SPAN_NAMES.WS_HEARTBEAT, {
        attributes: {
          [AI_ATTRIBUTES.WS_CONNECTION_ID]: socket.id,
          'chat.session_id': sessionId,
        },
      })

      try {
        socket.join(`session:${sessionId}`)
        socket.data.sessionId = sessionId

        // Send current progress immediately
        const progress = await redis.get(key('chat:status', sessionId))
        const logs = await redis.lrange(key('chat:logs', sessionId), 0, 19)

        socket.emit('session:state', {
          sessionId,
          status: progress || 'idle',
          logs: logs.reverse(),
        })

        span.setStatus({ code: SpanStatusCode.OK })
      } catch (error) {
        span.recordException(error as Error)
        span.setStatus({ code: SpanStatusCode.ERROR })
      } finally {
        span.end()
      }
    })

    // Leave session room
    socket.on('session:leave', (sessionId: string) => {
      socket.leave(`session:${sessionId}`)
      if (socket.data.sessionId === sessionId) {
        delete socket.data.sessionId
      }
    })

    // Client requests latest logs
    socket.on('session:logs', async (sessionId: string) => {
      const logs = await redis.lrange(key('chat:logs', sessionId), 0, 99)
      socket.emit('session:logs', { sessionId, logs: logs.reverse() })
    })

    // Subscribe to per-task progress channels
    socket.on('task:subscribe', async (taskId: string) => {
      const channel = `agenthive:agent:task:progress:${taskId}`
      await redisSub.subscribe(channel)
      socket.data.subscribedTask = taskId

      // Send current status immediately
      const status = await redis.get(`agenthive:agent:task:status:${taskId}`)
      socket.emit('task:state', { taskId, status: status || 'queued' })
    })

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('Chat WebSocket disconnected', { socketId: socket.id, reason })
    })
  })

  // Subscribe to Redis pub/sub for cross-instance broadcasts
  redisSub.subscribe(CHAT_PROGRESS_CHANNEL)
  redisSub.on('message', (channel: string, message: string) => {
    if (channel === CHAT_PROGRESS_CHANNEL) {
      try {
        const data = JSON.parse(message)
        chatNsp.to(`session:${data.sessionId}`).emit('session:update', data)
      } catch {
        // ignore invalid messages
      }
      return
    }

    // Handle per-task progress channels
    if (channel.startsWith('agenthive:agent:task:progress:')) {
      try {
        const data = JSON.parse(message)
        chatNsp.to(`session:${data.sessionId}`).emit('task:update', data)
      } catch {
        // ignore invalid messages
      }
    }
  })

  logger.info('Chat WebSocket namespace initialized')
}

// Helper to broadcast progress updates
export async function broadcastChatProgress(sessionId: string, payload: Record<string, unknown>): Promise<void> {
  const message = JSON.stringify({ sessionId, ...payload, timestamp: Date.now() })
  await redisPub.publish(CHAT_PROGRESS_CHANNEL, message)
}
