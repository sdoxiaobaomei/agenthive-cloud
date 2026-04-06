/**
 * Temp Directory Isolation
 * 
 * 使用临时目录创建隔离的工作环境
 * 适用于非 Git 项目或简单场景
 */

import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { EventEmitter } from 'events'
import type { IsolationConfig, IsolatedContext, IsolationResult } from './types.js'
import { DEFAULT_ISOLATION_CONFIG } from './types.js'
import { copyDirectory, safeRemoveDir, generateWorktreeName, validateDirectory } from './utils.js'
import { Logger } from '../../utils/logger.js'

export interface TempDirIsolationOptions {
  /** 是否自动清理 */
  autoCleanup?: boolean
  /** 临时目录前缀 */
  prefix?: string
  /** 最大并发隔离数 */
  maxConcurrent?: number
}

export class TempDirIsolation extends EventEmitter {
  private logger: Logger
  private contexts: Map<string, IsolatedContext> = new Map()
  private options: TempDirIsolationOptions

  constructor(options: TempDirIsolationOptions = {}) {
    super()
    this.options = {
      autoCleanup: true,
      prefix: 'agent-temp',
      maxConcurrent: 10,
      ...options
    }
    this.logger = new Logger('TempDirIsolation')
  }

  /**
   * 创建临时目录隔离环境
   */
  async createIsolatedContext(
    parentPath: string,
    config?: Partial<IsolationConfig>
  ): Promise<IsolationResult> {
    const mergedConfig = { ...DEFAULT_ISOLATION_CONFIG, ...config }

    this.logger.info('Creating temp directory isolation context', { parentPath })

    try {
      // 检查并发限制
      if (this.contexts.size >= (this.options.maxConcurrent || 10)) {
        return {
          success: false,
          error: `Maximum concurrent isolations reached: ${this.options.maxConcurrent}`
        }
      }

      // 验证父目录
      if (!(await validateDirectory(parentPath))) {
        return {
          success: false,
          error: `Parent directory does not exist or is not accessible: ${parentPath}`
        }
      }

      // 生成唯一的临时目录名
      const tempName = generateWorktreeName(this.options.prefix)
      const tempPath = join(tmpdir(), tempName)

      // 创建临时目录
      await fs.mkdir(tempPath, { recursive: true })

      // 复制文件（如果需要）
      if (mergedConfig.inheritFiles) {
        await this.copyProjectFiles(parentPath, tempPath, mergedConfig)
      }

      // 创建隔离上下文
      const context: IsolatedContext = {
        workPath: tempPath,
        parentPath: resolve(parentPath),
        mode: 'temp',
        cleanup: () => this.cleanup(tempName),
        isCleaned: false,
        createdAt: Date.now()
      }

      this.contexts.set(tempName, context)

      this.logger.info('Temp directory isolation context created', {
        tempPath,
        parentPath: resolve(parentPath)
      })

      this.emit('context:created', { tempName, context })

      // 设置自动清理（如果需要）
      if (this.options.autoCleanup) {
        this.scheduleCleanup(tempName)
      }

      return {
        success: true,
        context
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Failed to create temp isolation', { error: errorMessage })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 复制项目文件到临时目录
   */
  private async copyProjectFiles(
    parentPath: string,
    tempPath: string,
    config: IsolationConfig
  ): Promise<void> {
    const excludePatterns = [
      ...config.excludePatterns || [],
      // 默认排除项
      '.git',
      'node_modules',
      '.cache',
      '*.log',
      'dist',
      'build',
      'coverage',
      '.nyc_output'
    ]

    // 如果不复制 node_modules，添加到排除列表
    if (!config.copyNodeModules) {
      excludePatterns.push('node_modules')
    }

    try {
      await copyDirectory(parentPath, tempPath, {
        exclude: excludePatterns,
        preserveSymlinks: false
      })

      this.logger.debug('Project files copied', {
        from: parentPath,
        to: tempPath,
        excludeCount: excludePatterns.length
      })

    } catch (error) {
      this.logger.error('Failed to copy project files', { error })
      throw error
    }
  }

  /**
   * 快速复制（仅关键文件）
   * 用于性能敏感场景
   */
  async createQuickIsolatedContext(
    parentPath: string,
    includePatterns: string[] = ['**/*.ts', '**/*.js', '**/*.json', '**/*.md']
  ): Promise<IsolationResult> {
    const config: Partial<IsolationConfig> = {
      mode: 'temp',
      inheritFiles: true,
      copyNodeModules: false,
      preserveGit: false,
      excludePatterns: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '*.log',
        '.cache',
        'coverage'
      ]
    }

    return this.createIsolatedContext(parentPath, config)
  }

  /**
   * 创建空隔离环境（不复制文件）
   */
  async createEmptyIsolatedContext(
    parentPath: string
  ): Promise<IsolationResult> {
    const config: Partial<IsolationConfig> = {
      mode: 'temp',
      inheritFiles: false,
      copyNodeModules: false,
      preserveGit: false
    }

    return this.createIsolatedContext(parentPath, config)
  }

  /**
   * 清理临时目录
   */
  async cleanup(tempName: string): Promise<void> {
    const context = this.contexts.get(tempName)
    if (!context) {
      this.logger.warn(`Temp context not found: ${tempName}`)
      return
    }

    if (context.isCleaned) {
      this.logger.debug(`Temp context already cleaned: ${tempName}`)
      return
    }

    this.logger.info('Cleaning up temp directory', {
      tempName,
      path: context.workPath
    })

    try {
      await safeRemoveDir(context.workPath)
      
      context.isCleaned = true
      this.contexts.delete(tempName)
      
      this.emit('context:cleaned', { tempName, context })
      this.logger.info('Temp directory cleaned up', { tempName })

    } catch (error) {
      this.logger.error('Error during temp cleanup', { error, tempName })
    }
  }

  /**
   * 清理所有临时目录
   */
  async cleanupAll(): Promise<void> {
    this.logger.info(`Cleaning up all temp contexts (${this.contexts.size} total)`)

    const promises = Array.from(this.contexts.keys()).map(name => this.cleanup(name))
    await Promise.all(promises)
  }

  /**
   * 安排自动清理
   */
  private scheduleCleanup(tempName: string, delayMs = 3600000): void {
    // 默认 1 小时后自动清理
    setTimeout(() => {
      this.cleanup(tempName).catch(error => {
        this.logger.error('Auto cleanup failed', { error, tempName })
      })
    }, delayMs)
  }

  /**
   * 获取所有活动的上下文
   */
  getActiveContexts(): IsolatedContext[] {
    return Array.from(this.contexts.values())
  }

  /**
   * 检查上下文是否活动
   */
  isActive(tempName: string): boolean {
    return this.contexts.has(tempName)
  }

  /**
   * 获取活动上下文数量
   */
  getActiveCount(): number {
    return this.contexts.size
  }

  /**
   * 获取上下文信息
   */
  getContext(tempName: string): IsolatedContext | undefined {
    return this.contexts.get(tempName)
  }
}

// 导出单例
export const tempDirIsolation = new TempDirIsolation()
