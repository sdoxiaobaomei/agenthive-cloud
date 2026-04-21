// WebSocket 客户端 - 与 Supervisor 通信
import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { injectTraceContextIntoPayload } from '@agenthive/observability'

interface WSMessage {
  type: string
  payload: unknown
  timestamp: string
}

export class WebSocketClient extends EventEmitter {
  private url: string
  private agentId: string
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isConnected = false
  private isConnecting = false
  private messageQueue: WSMessage[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 5000

  constructor(url: string, agentId: string) {
    super()
    this.url = url
    this.agentId = agentId
  }

  // 连接 WebSocket
  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) return
    
    this.isConnecting = true
    
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.url}?agentId=${this.agentId}`
        this.ws = new WebSocket(wsUrl)

        this.ws.on('open', () => {
          this.isConnected = true
          this.isConnecting = false
          this.reconnectAttempts = 0
          
          // 发送队列中的消息
          this.flushMessageQueue()
          
          this.emit('connected')
          resolve()
        })

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString())
            this.emit('message', message)
          } catch (error) {
            console.error('Failed to parse message:', error)
          }
        })

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.isConnected = false
          this.isConnecting = false
          this.emit('disconnected', code, reason)
          
          // 自动重连
          if (code !== 1000) {
            this.scheduleReconnect()
          }
        })

        this.ws.on('error', (error: Error) => {
          this.isConnecting = false
          this.emit('error', error)
          reject(error)
        })
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  // 断开连接
  async disconnect(): Promise<void> {
    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (!this.ws) return

    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.on('close', () => {
          this.isConnected = false
          resolve()
        })
        
        this.ws.close(1000, 'Agent shutdown')
        this.ws = null
      } else {
        resolve()
      }
    })
  }

  // 发送消息
  async send(type: string, payload: unknown): Promise<void> {
    // 注入 trace context 到 payload，实现跨 WebSocket 的追踪传播
    const payloadWithTrace = typeof payload === 'object' && payload !== null
      ? injectTraceContextIntoPayload(payload as Record<string, unknown>)
      : payload

    const message: WSMessage = {
      type,
      payload: payloadWithTrace,
      timestamp: new Date().toISOString()
    }

    if (!this.isConnected) {
      // 离线时加入队列
      this.messageQueue.push(message)
      return
    }

    this.sendMessage(message)
  }

  // 检查连接状态
  isReady(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  // 私有方法：发送消息
  private sendMessage(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message)
      return
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send message:', error)
      this.messageQueue.push(message)
    }
  }

  // 私有方法：刷新消息队列
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.sendMessage(message)
      }
    }
  }

  // 私有方法：计划重连
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      this.emit('reconnect_failed')
      return
    }

    this.reconnectAttempts++
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      60000 // 最大 60 秒
    )

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnect failed:', error)
      })
    }, delay)
  }
}
