// Redis 缓存服务
import redis, { key } from '../config/redis.js'

// 默认 TTL (秒)
const DEFAULT_TTL = 300 // 5 分钟
const SESSION_TTL = 86400 // 24 小时
const AGENT_STATUS_TTL = 60 // 1 分钟

export const redisCache = {
  // ============ 通用缓存 ============
  
  /**
   * 设置缓存
   */
  set: async (namespace: string, id: string, data: unknown, ttl: number = DEFAULT_TTL): Promise<void> => {
    const k = key(namespace, id)
    await redis.setex(k, ttl, JSON.stringify(data))
  },

  /**
   * 获取缓存
   */
  get: async <T>(namespace: string, id: string): Promise<T | null> => {
    const k = key(namespace, id)
    const data = await redis.get(k)
    return data ? JSON.parse(data) : null
  },

  /**
   * 删除缓存
   */
  del: async (namespace: string, id: string): Promise<void> => {
    const k = key(namespace, id)
    await redis.del(k)
  },

  /**
   * 检查是否存在
   */
  exists: async (namespace: string, id: string): Promise<boolean> => {
    const k = key(namespace, id)
    const result = await redis.exists(k)
    return result === 1
  },

  /**
   * 设置过期时间
   */
  expire: async (namespace: string, id: string, ttl: number): Promise<void> => {
    const k = key(namespace, id)
    await redis.expire(k, ttl)
  },

  // ============ 会话缓存 ============
  
  /**
   * 保存会话
   */
  setSession: async (token: string, userId: string, userData: unknown): Promise<void> => {
    const data = { userId, userData, createdAt: Date.now() }
    await redis.setex(key('session', token), SESSION_TTL, JSON.stringify(data))
  },

  /**
   * 获取会话
   */
  getSession: async (token: string): Promise<{ userId: string; userData: unknown } | null> => {
    const data = await redis.get(key('session', token))
    if (!data) return null
    
    const parsed = JSON.parse(data)
    // 刷新 TTL
    await redis.expire(key('session', token), SESSION_TTL)
    return parsed
  },

  /**
   * 删除会话
   */
  delSession: async (token: string): Promise<void> => {
    await redis.del(key('session', token))
  },

  // ============ Agent 状态缓存 ============
  
  /**
   * 设置 Agent 状态
   */
  setAgentStatus: async (agentId: string, status: string, metadata?: Record<string, unknown>): Promise<void> => {
    const data = { status, metadata, updatedAt: Date.now() }
    await redis.setex(key('agent:status', agentId), AGENT_STATUS_TTL, JSON.stringify(data))
  },

  /**
   * 获取 Agent 状态
   */
  getAgentStatus: async (agentId: string): Promise<{ status: string; metadata?: Record<string, unknown>; updatedAt: number } | null> => {
    const data = await redis.get(key('agent:status', agentId))
    return data ? JSON.parse(data) : null
  },

  /**
   * 获取所有在线 Agent
   */
  getOnlineAgents: async (): Promise<string[]> => {
    const pattern = key('agent:status', '*')
    const keys = await redis.keys(pattern)
    return keys.map((k: string) => k.replace(key('agent:status', ''), ''))
  },

  /**
   * 更新 Agent 心跳
   */
  updateAgentHeartbeat: async (agentId: string): Promise<void> => {
    await redis.setex(key('agent:heartbeat', agentId), AGENT_STATUS_TTL, Date.now().toString())
  },

  /**
   * 检查 Agent 是否在线
   */
  isAgentOnline: async (agentId: string): Promise<boolean> => {
    const result = await redis.exists(key('agent:status', agentId))
    return result === 1
  },

  // ============ 任务进度缓存 ============
  
  /**
   * 设置任务进度
   */
  setTaskProgress: async (taskId: string, progress: number, metadata?: Record<string, unknown>): Promise<void> => {
    const data = { progress, metadata, updatedAt: Date.now() }
    await redis.setex(key('task:progress', taskId), DEFAULT_TTL, JSON.stringify(data))
  },

  /**
   * 获取任务进度
   */
  getTaskProgress: async (taskId: string): Promise<{ progress: number; metadata?: Record<string, unknown>; updatedAt: number } | null> => {
    const data = await redis.get(key('task:progress', taskId))
    return data ? JSON.parse(data) : null
  },

  // ============ 日志缓存 (用于实时推送) ============
  
  /**
   * 添加日志到列表
   */
  addLog: async (agentId: string, log: string, maxLogs: number = 100): Promise<void> => {
    const k = key('agent:logs', agentId)
    await redis.lpush(k, log)
    await redis.ltrim(k, 0, maxLogs - 1)
    await redis.expire(k, DEFAULT_TTL)
  },

  /**
   * 获取日志列表
   */
  getLogs: async (agentId: string, limit: number = 100): Promise<string[]> => {
    const k = key('agent:logs', agentId)
    return redis.lrange(k, 0, limit - 1)
  },

  // ============ 速率限制 ============
  
  /**
   * 检查是否超过速率限制
   */
  checkRateLimit: async (identifier: string, maxRequests: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
    const k = key('ratelimit', identifier)
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / windowSeconds) * windowSeconds
    
    const current = await redis.get(k)
    const count = current ? parseInt(current) : 0
    
    if (count >= maxRequests) {
      const ttl = await redis.ttl(k)
      return { allowed: false, remaining: 0, resetTime: windowStart + windowSeconds }
    }
    
    // 增加计数
    const pipeline = redis.pipeline()
    pipeline.incr(k)
    pipeline.expireat(k, windowStart + windowSeconds)
    await pipeline.exec()
    
    return { allowed: true, remaining: maxRequests - count - 1, resetTime: windowStart + windowSeconds }
  },

  // ============ 发布/订阅 ============
  
  /**
   * 发布消息
   */
  publish: async (channel: string, message: unknown): Promise<void> => {
    await redis.publish(channel, JSON.stringify(message))
  },

  /**
   * 订阅频道
   */
  subscribe: (channel: string, callback: (message: unknown) => void): void => {
    redis.subscribe(channel)
    redis.on('message', (ch: string, msg: string) => {
      if (ch === channel) {
        callback(JSON.parse(msg))
      }
    })
  },

  // ============ 清理 ============
  
  /**
   * 清空所有缓存
   */
  flushAll: async (): Promise<void> => {
    await redis.flushdb()
  },

  /**
   * 按模式删除键
   */
  deletePattern: async (pattern: string): Promise<void> => {
    const keys = await redis.keys(key(pattern, '*'))
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },
}

export default redisCache
