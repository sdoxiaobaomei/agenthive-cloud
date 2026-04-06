// 文件系统服务
import fs from 'fs/promises'
import path from 'path'
import { Logger } from '../utils/logger.js'

export class FileSystemService {
  private workspacePath: string
  private logger: Logger

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.logger = new Logger('FileSystem')
  }

  // 初始化工作空间
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.workspacePath, { recursive: true })
      this.logger.info('Workspace initialized', { path: this.workspacePath })
    } catch (error) {
      this.logger.error('Failed to initialize workspace', { error })
      throw error
    }
  }

  // 读取文件
  async readFile(relativePath: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath)
    return fs.readFile(fullPath, 'utf-8')
  }

  // 写入文件
  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath)
    
    // 确保目录存在
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    
    await fs.writeFile(fullPath, content, 'utf-8')
  }

  // 删除文件
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath)
    await fs.unlink(fullPath)
  }

  // 检查文件是否存在
  async exists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(relativePath)
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  // 列出目录
  async listDir(relativePath: string = ''): Promise<string[]> {
    const fullPath = this.resolvePath(relativePath)
    return fs.readdir(fullPath)
  }

  // 创建目录
  async createDir(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath)
    await fs.mkdir(fullPath, { recursive: true })
  }

  // 删除目录
  async deleteDir(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath)
    await fs.rmdir(fullPath, { recursive: true })
  }

  // 获取文件信息
  async getStats(relativePath: string): Promise<{
    size: number
    created: Date
    modified: Date
    isFile: boolean
    isDirectory: boolean
  }> {
    const fullPath = this.resolvePath(relativePath)
    const stats = await fs.stat(fullPath)
    
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    }
  }

  // 搜索文件
  async searchFiles(pattern: string): Promise<string[]> {
    const results: string[] = []
    
    const searchRecursive = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(this.workspacePath, fullPath)
        
        if (entry.isDirectory()) {
          await searchRecursive(fullPath)
        } else if (entry.name.includes(pattern)) {
          results.push(relativePath)
        }
      }
    }
    
    await searchRecursive(this.workspacePath)
    return results
  }

  // 解析路径（确保安全，不超出工作空间）
  private resolvePath(relativePath: string): string {
    // 清理路径，移除 .. 等
    const cleanPath = path.normalize(relativePath).replace(/^(\.\.(\/|$))+/, '')
    return path.join(this.workspacePath, cleanPath)
  }

  // 获取工作空间路径
  getWorkspacePath(): string {
    return this.workspacePath
  }
}
