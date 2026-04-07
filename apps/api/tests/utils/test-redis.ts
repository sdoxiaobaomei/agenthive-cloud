// Redis 测试工具

// 模拟 Redis 数据存储
const mockRedisStore = new Map<string, { value: string; expiresAt?: number }>()

// 模拟 Redis 客户端
export const createMockRedis = () => {
  const store = mockRedisStore

  const clearStore = () => store.clear()

  const redis = {
    get: async (key: string): Promise<string | null> => {
      const item = store.get(key)
      if (!item) return null
      if (item.expiresAt && item.expiresAt < Date.now()) {
        store.delete(key)
        return null
      }
      return item.value
    },

    setex: async (key: string, seconds: number, value: string): Promise<string> => {
      store.set(key, {
        value,
        expiresAt: Date.now() + seconds * 1000,
      })
      return 'OK'
    },

    set: async (key: string, value: string): Promise<string> => {
      store.set(key, { value })
      return 'OK'
    },

    del: async (...keys: string[]): Promise<number> => {
      let count = 0
      for (const key of keys) {
        if (store.delete(key)) count++
      }
      return count
    },

    exists: async (key: string): Promise<number> => {
      const item = store.get(key)
      if (!item) return 0
      if (item.expiresAt && item.expiresAt < Date.now()) {
        store.delete(key)
        return 0
      }
      return 1
    },

    expire: async (key: string, seconds: number): Promise<number> => {
      const item = store.get(key)
      if (!item) return 0
      item.expiresAt = Date.now() + seconds * 1000
      return 1
    },

    ttl: async (key: string): Promise<number> => {
      const item = store.get(key)
      if (!item) return -2
      if (!item.expiresAt) return -1
      const ttl = Math.ceil((item.expiresAt - Date.now()) / 1000)
      return ttl > 0 ? ttl : -2
    },

    keys: async (pattern: string): Promise<string[]> => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      return Array.from(store.keys()).filter(k => regex.test(k))
    },

    lpush: async (key: string, ...values: string[]): Promise<number> => {
      const list = JSON.parse(store.get(key)?.value || '[]')
      list.unshift(...values)
      store.set(key, { value: JSON.stringify(list) })
      return list.length
    },

    ltrim: async (key: string, start: number, stop: number): Promise<string> => {
      const list = JSON.parse(store.get(key)?.value || '[]')
      const trimmed = list.slice(start, stop + 1)
      store.set(key, { value: JSON.stringify(trimmed) })
      return 'OK'
    },

    lrange: async (key: string, start: number, stop: number): Promise<string[]> => {
      const list = JSON.parse(store.get(key)?.value || '[]')
      return list.slice(start, stop === -1 ? undefined : stop + 1)
    },

    incr: async (key: string): Promise<number> => {
      const item = store.get(key)
      const value = parseInt(item?.value || '0') + 1
      store.set(key, { value: value.toString() })
      return value
    },

    expireat: async (key: string, timestamp: number): Promise<number> => {
      const item = store.get(key)
      if (!item) return 0
      item.expiresAt = timestamp * 1000
      return 1
    },

    pipeline: () => ({
      incr: (key: string) => {
        redis.incr(key)
        return { expireat: () => ({ exec: async () => [[null, 1], [null, 1]] }) }
      },
      expireat: () => ({ exec: async () => [[null, 1], [null, 1]] }),
      exec: async () => [[null, 1], [null, 1]],
    }),

    publish: async (channel: string, message: string): Promise<number> => 1,

    subscribe: async (channel: string): Promise<void> => {},

    flushdb: async (): Promise<string> => {
      store.clear()
      return 'OK'
    },

    ping: async (): Promise<string> => 'PONG',

    quit: async (): Promise<string> => 'OK',

    on: (event: string, callback: Function): void => {},
  }

  return { redis, clearStore }
}

// 清理所有 Redis 数据
export function clearRedisData() {
  mockRedisStore.clear()
}

// 初始化测试数据
export function initRedisTestData() {
  mockRedisStore.set('agenthive:test:key1', { value: JSON.stringify({ data: 'value1' }) })
  mockRedisStore.set('agenthive:test:key2', { value: JSON.stringify({ data: 'value2' }) })
}

// 获取存储内容（用于调试）
export function getRedisStore() {
  return new Map(mockRedisStore)
}
