// MCP (Model Context Protocol) 客户端 - 简化版
import { EventEmitter } from 'events'
import { spawn, type ChildProcess } from 'child_process'
import { Logger } from '../utils/logger.js'

export interface MCPConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: object
}

export interface MCPResource {
  uri: string
  name: string
  mimeType?: string
}

export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null
  private config: MCPConfig
  private logger: Logger
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>()
  private tools: MCPTool[] = []
  private resources: MCPResource[] = []
  private initialized = false

  constructor(config: MCPConfig) {
    super()
    this.config = config
    this.logger = new Logger(`MCP:${config.name}`)
  }

  async connect(): Promise<void> {
    if (this.process) {
      return
    }

    this.logger.info(`Connecting to MCP server: ${this.config.command}`)

    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...this.config.env }
      
      this.process = spawn(this.config.command, this.config.args || [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleMessage(data.toString())
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.logger.warn(`MCP stderr: ${data.toString()}`)
      })

      this.process.on('error', (error) => {
        this.logger.error('MCP process error', { error })
        reject(error)
      })

      this.process.on('close', (code) => {
        this.logger.info(`MCP process exited with code ${code}`)
        this.process = null
        this.initialized = false
        this.emit('disconnected')
      })

      // 初始化
      setTimeout(async () => {
        try {
          await this.initialize()
          resolve()
        } catch (error) {
          reject(error)
        }
      }, 500)
    })
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
    this.initialized = false
    this.tools = []
    this.resources = []
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {}
      },
      clientInfo: {
        name: 'agent-runtime',
        version: '1.0.0'
      }
    })

    this.initialized = true
    this.emit('initialized', result)

    // 获取工具列表
    await this.listTools()
    
    // 获取资源列表
    await this.listResources()
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.process?.stdin) {
      throw new Error('MCP client not connected')
    }

    const id = ++this.requestId
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      
      this.process!.stdin!.write(JSON.stringify(request) + '\n')

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout: ${method}`))
        }
      }, 30000)
    })
  }

  private handleMessage(data: string): void {
    const lines = data.split('\n').filter(l => l.trim())
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line)
        
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!
          this.pendingRequests.delete(message.id)
          
          if (message.error) {
            reject(new Error(message.error.message))
          } else {
            resolve(message.result)
          }
        }
        
        if (message.method === 'notifications/message') {
          this.emit('notification', message.params)
        }
      } catch (error) {
        this.logger.error('Failed to parse MCP message', { error, line })
      }
    }
  }

  // 获取工具列表
  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized')
    }

    try {
      const result = await this.sendRequest('tools/list')
      this.tools = result.tools || []
      return this.tools
    } catch (error) {
      this.logger.error('Failed to list tools', { error })
      return []
    }
  }

  // 调用工具
  async callTool(name: string, args: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized')
    }

    return this.sendRequest('tools/call', {
      name,
      arguments: args
    })
  }

  // 获取资源列表
  async listResources(): Promise<MCPResource[]> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized')
    }

    try {
      const result = await this.sendRequest('resources/list')
      this.resources = result.resources || []
      return this.resources
    } catch (error) {
      this.logger.error('Failed to list resources', { error })
      return []
    }
  }

  // 读取资源
  async readResource(uri: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized')
    }

    return this.sendRequest('resources/read', { uri })
  }

  // 获取已缓存的工具
  getTools(): MCPTool[] {
    return [...this.tools]
  }

  // 获取已缓存的资源
  getResources(): MCPResource[] {
    return [...this.resources]
  }

  isConnected(): boolean {
    return this.initialized && this.process !== null
  }
}

// MCP 客户端管理器
export class MCPClientManager extends EventEmitter {
  private clients = new Map<string, MCPClient>()
  private logger = new Logger('MCPManager')

  async addClient(config: MCPConfig): Promise<MCPClient> {
    const client = new MCPClient(config)
    
    client.on('disconnected', () => {
      this.logger.warn(`MCP client disconnected: ${config.name}`)
      this.emit('clientDisconnected', config.name)
    })

    await client.connect()
    this.clients.set(config.name, client)
    this.logger.info(`MCP client added: ${config.name}`)
    
    return client
  }

  removeClient(name: string): void {
    const client = this.clients.get(name)
    if (client) {
      client.disconnect()
      this.clients.delete(name)
      this.logger.info(`MCP client removed: ${name}`)
    }
  }

  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name)
  }

  listClients(): string[] {
    return Array.from(this.clients.keys())
  }

  async callTool(clientName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(clientName)
    if (!client) {
      throw new Error(`MCP client not found: ${clientName}`)
    }
    return client.callTool(toolName, args)
  }

  getAllTools(): Array<{ client: string; tool: MCPTool }> {
    const all: Array<{ client: string; tool: MCPTool }> = []
    for (const [name, client] of this.clients) {
      for (const tool of client.getTools()) {
        all.push({ client: name, tool })
      }
    }
    return all
  }

  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      await client.disconnect()
    }
    this.clients.clear()
  }
}

// 全局 MCP 管理器
export const globalMCPManager = new MCPClientManager()
