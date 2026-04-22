// Redis 配置
import { Redis } from 'ioredis'

const getRedisConfig = () => {
  if (process.env.REDIS_URL && !process.env.REDIS_HOST) {
    const url = new URL(process.env.REDIS_URL)
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
    }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  }
}

const redisConfig = {
  ...getRedisConfig(),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  maxRetriesPerRequest: 3,
}

// 创建 Redis 客户端
export const redis = new Redis(redisConfig)

// 发布/订阅用的单独连接
export const redisPub = new Redis(redisConfig)
export const redisSub = new Redis(redisConfig)

// 键前缀
export const KEY_PREFIX = 'agenthive:'

// 生成带前缀的键
export const key = (namespace: string, id: string): string => `${KEY_PREFIX}${namespace}:${id}`

// 测试连接
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redis.ping()
    console.log('[Redis] Connected successfully')
    return true
  } catch (error) {
    console.error('[Redis] Connection failed:', error)
    return false
  }
}

// 关闭连接
export const closeRedis = async (): Promise<void> => {
  await redis.quit()
  await redisPub.quit()
  await redisSub.quit()
}

// Redis 事件监听
redis.on('connect', () => console.log('[Redis] Connecting...'))
redis.on('ready', () => console.log('[Redis] Ready'))
redis.on('error', (err: Error) => console.error('[Redis] Error:', err.message))
redis.on('close', () => console.log('[Redis] Connection closed'))

export default redis
