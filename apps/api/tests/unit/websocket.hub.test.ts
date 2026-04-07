// WebSocket Hub 测试
import { describe, it, expect } from 'vitest'

describe('WebSocket Hub', () => {
  it('应该导出 initWebSocket', async () => {
    const hub = await import('../../src/websocket/hub.js')
    expect(hub.initWebSocket).toBeDefined()
    expect(typeof hub.initWebSocket).toBe('function')
  })

  it('应该导出 broadcast', async () => {
    const hub = await import('../../src/websocket/hub.js')
    expect(hub.broadcast).toBeDefined()
    expect(typeof hub.broadcast.agentStatus).toBe('function')
    expect(typeof hub.broadcast.taskProgress).toBe('function')
    expect(typeof hub.broadcast.log).toBe('function')
  })

  it('应该导出 getStats', async () => {
    const hub = await import('../../src/websocket/hub.js')
    expect(hub.getStats).toBeDefined()
    expect(typeof hub.getStats).toBe('function')
  })
})
