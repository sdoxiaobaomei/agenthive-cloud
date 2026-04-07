// WebSocket 测试工具
import { vi } from 'vitest'

// 创建模拟 Socket
export function createMockSocket(overrides: Partial<any> = {}) {
  const eventHandlers: Record<string, Function[]> = {}

  const socket = {
    id: 'socket-' + Math.random().toString(36).substring(2, 8),
    data: {},
    handshake: {
      auth: {},
    },
    connected: true,
    disconnected: false,

    join: vi.fn((room: string) => {
      socket.rooms.add(room)
    }),

    leave: vi.fn((room: string) => {
      socket.rooms.delete(room)
    }),

    emit: vi.fn((event: string, ...args: any[]) => {
      const handlers = eventHandlers[event] || []
      handlers.forEach(h => h(...args))
    }),

    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = []
      }
      eventHandlers[event].push(handler)
    }),

    off: vi.fn((event: string, handler: Function) => {
      const handlers = eventHandlers[event] || []
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }),

    disconnect: vi.fn((close?: boolean) => {
      socket.connected = false
      socket.disconnected = true
      if (close) {
        socket.emit('disconnect', 'forced')
      }
    }),

    // 测试辅助方法
    trigger: (event: string, ...args: any[]) => {
      const handlers = eventHandlers[event] || []
      handlers.forEach(h => h(...args))
    },

    rooms: new Set<string>(),
    
    ...overrides,
  }

  return socket
}

// 创建模拟 Socket.io Server
export function createMockIOServer() {
  const sockets = new Map<string, any>()
  const middlewares: Function[] = []
  const eventHandlers: Record<string, Function[]> = {}

  const io = {
    sockets,
    
    use: vi.fn((middleware: Function) => {
      middlewares.push(middleware)
    }),

    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = []
      }
      eventHandlers[event].push(handler)
    }),

    to: vi.fn((room: string) => ({
      emit: vi.fn((event: string, ...args: any[]) => {
        // 广播给房间内的所有 socket
        for (const socket of sockets.values()) {
          if (socket.rooms.has(room)) {
            socket.emit(event, ...args)
          }
        }
      }),
    })),

    emit: vi.fn((event: string, ...args: any[]) => {
      // 广播给所有 socket
      for (const socket of sockets.values()) {
        socket.emit(event, ...args)
      }
    }),

    fetchSockets: vi.fn(async () => {
      return Array.from(sockets.values())
    }),

    // 测试辅助方法
    connect: async (socket: any) => {
      sockets.set(socket.id, socket)
      
      // 运行中间件
      for (const middleware of middlewares) {
        const next = vi.fn()
        await middleware(socket, next)
        if (next.mock.calls[0]?.[0] instanceof Error) {
          throw next.mock.calls[0][0]
        }
      }
      
      // 触发连接事件
      eventHandlers['connection']?.forEach(h => h(socket))
      
      return socket
    },

    disconnect: (socketId: string) => {
      const socket = sockets.get(socketId)
      if (socket) {
        socket.disconnect(true)
        sockets.delete(socketId)
      }
    },

    disconnectAll: () => {
      for (const socket of sockets.values()) {
        socket.disconnect(true)
      }
      sockets.clear()
    },

    getStats: () => ({
      total: sockets.size,
      authenticated: Array.from(sockets.values()).filter((s: any) => !s.data.isVisitor).length,
      visitors: Array.from(sockets.values()).filter((s: any) => s.data.isVisitor).length,
    }),
  }

  return io
}

// 等待 WebSocket 事件
export function waitForEvent(socket: any, event: string, timeout = 1000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`))
    }, timeout)

    const handler = (...args: any[]) => {
      clearTimeout(timer)
      resolve(args.length === 1 ? args[0] : args)
    }

    socket.on(event, handler)
  })
}

// 等待指定时间
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 创建测试房间
export function createTestRoom(io: any, roomName: string, sockets: any[]) {
  for (const socket of sockets) {
    socket.join(roomName)
  }
}

// 模拟 JWT Token
export function createTestToken(payload: object): string {
  return 'test-token-' + Buffer.from(JSON.stringify(payload)).toString('base64')
}
