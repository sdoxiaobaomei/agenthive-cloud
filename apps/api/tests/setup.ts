// 测试环境设置
import { beforeEach, afterEach, vi } from 'vitest'

// 设置测试环境
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
process.env.DB_HOST = 'localhost'
process.env.DB_PORT = '5432'
process.env.DB_NAME = 'agenthive'
process.env.DB_USER = 'agenthive'
process.env.DB_PASSWORD = 'dev'

// Mock ioredis — 集成测试需要 Redis 连接但不一定有 Redis 服务
// 创建一个模拟的 Redis 客户端，所有方法返回空/成功
function createMockRedis() {
  const handlers: Record<string, Function[]> = {}
  return {
    on: vi.fn((event: string, cb: Function) => {
      if (event === 'ready') setTimeout(() => cb(), 0)
      return this
    }),
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(),
    quit: vi.fn(() => Promise.resolve('OK')),
    ping: vi.fn(() => Promise.resolve('PONG')),
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve('OK')),
    del: vi.fn(() => Promise.resolve(1)),
    exists: vi.fn(() => Promise.resolve(0)),
    expire: vi.fn(() => Promise.resolve(1)),
    ttl: vi.fn(() => Promise.resolve(-2)),
    incr: vi.fn(() => Promise.resolve(1)),
    decr: vi.fn(() => Promise.resolve(0)),
    hget: vi.fn(() => Promise.resolve(null)),
    hset: vi.fn(() => Promise.resolve(1)),
    hdel: vi.fn(() => Promise.resolve(1)),
    hgetall: vi.fn(() => Promise.resolve({})),
    lpush: vi.fn(() => Promise.resolve(1)),
    rpush: vi.fn(() => Promise.resolve(1)),
    lrange: vi.fn(() => Promise.resolve([])),
    llen: vi.fn(() => Promise.resolve(0)),
    sadd: vi.fn(() => Promise.resolve(1)),
    srem: vi.fn(() => Promise.resolve(1)),
    smembers: vi.fn(() => Promise.resolve([])),
    sismember: vi.fn(() => Promise.resolve(0)),
    zadd: vi.fn(() => Promise.resolve(1)),
    zrange: vi.fn(() => Promise.resolve([])),
    zrem: vi.fn(() => Promise.resolve(1)),
    xadd: vi.fn(() => Promise.resolve('0-0')),
    xreadgroup: vi.fn(() => Promise.resolve(null)),
    xack: vi.fn(() => Promise.resolve(1)),
    xgroup: vi.fn(() => Promise.resolve('OK')),
    xrevrange: vi.fn(() => Promise.resolve([])),
    publish: vi.fn(() => Promise.resolve(0)),
    subscribe: vi.fn(() => Promise.resolve('OK')),
    psubscribe: vi.fn(() => Promise.resolve('OK')),
    unsubscribe: vi.fn(() => Promise.resolve('OK')),
    keys: vi.fn(() => Promise.resolve([])),
    scan: vi.fn(() => Promise.resolve(['0', []])),
    flushdb: vi.fn(() => Promise.resolve('OK')),
    flushall: vi.fn(() => Promise.resolve('OK')),
    script: vi.fn(() => Promise.resolve('')),
    eval: vi.fn(() => Promise.resolve(null)),
    evalsha: vi.fn(() => Promise.resolve(null)),
    duplicate: vi.fn(function (this: any) { return createMockRedis() }),
    pipeline: vi.fn(function (this: any) {
      const commands: any[] = []
      const mockPipeline = {
        incr: vi.fn(() => { commands.push(['incr', 1]); return mockPipeline }),
        pexpire: vi.fn(() => { commands.push(['pexpire', 1]); return mockPipeline }),
        decr: vi.fn(() => { commands.push(['decr', 0]); return mockPipeline }),
        del: vi.fn(() => { commands.push(['del', 1]); return mockPipeline }),
        exec: vi.fn(() => Promise.resolve(commands.map(c => [null, c[1] || 1]))),
      }
      return mockPipeline
    }),
  } as any
}

vi.mock('ioredis', () => {
  return {
    Redis: vi.fn(() => createMockRedis()),
    default: vi.fn(() => createMockRedis()),
  }
})

// 模拟 console 方法以减少测试输出噪音
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  // 保留 warn 和 error 用于调试
  warn: console.warn,
  error: console.error,
}

// 在每个测试前清理
beforeEach(() => {
  vi.clearAllMocks()
})

// 在每个测试后清理
afterEach(() => {
  vi.clearAllTimers()
})
