/**
 * Worktree Isolation
 * 
 * 使用 Git worktree 创建隔离的工作环境
 * 参考 Claude Code 的 forkSubagent.ts 实现
 */

import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { EventEmitter } from 'events'
import type { IsolationConfig, IsolatedContext, IsolationResult, WorktreeInfo } from './types.js'
import { DEFAULT_ISOLATION_CONFIG, WORKTREE_ISOLATION_CONFIG } from './types.js'
import {
  isGitRepository,
  execGit,
  generateWorktreeName,
  safeRemoveDir,
  validateDirectory
} from './utils.js'
import { Logger } from '../../utils/logger.js'

export interface WorktreeIsolationOptions {
  /** 是否自动清理 */
  autoCleanup?: boolean
  /** 清理延迟（毫秒） */
  cleanupDelay?: number
}

export class WorktreeIsolation extends EventEmitter {
  private logger: Logger
  private worktrees: Map<string, WorktreeInfo> = new Map()
  private options: WorktreeIsolationOptions

  constructor(options: WorktreeIsolationOptions = {}) {
    super()
    this.options = {
      autoCleanup: true,
      cleanupDelay: 0,
      ...options
    }
    this.logger = new Logger('WorktreeIsolation')
  }

  /**
   * 创建隔离的 Git worktree 环境
   */
  async createIsolatedContext(
    parentPath: string,
    config?: Partial<IsolationConfig>
  ): Promise<IsolationResult> {
    const mergedConfig = { ...WORKTREE_ISOLATION_CONFIG, ...config }
    
    this.logger.info('Creating worktree isolation context', { parentPath })

    try {
      // 验证父目录是 Git 仓库
      if (!(await isGitRepository(parentPath))) {
        return {
          success: false,
          error: 'Parent directory is not a Git repository. Use temp isolation instead.'
        }
      }

      // 生成唯一的工作树名称
      const worktreeName = generateWorktreeName('agent-worktree')
      const worktreePath = join(tmpdir(), worktreeName)

      // 创建 worktree
      const worktreeResult = await this.createWorktree(parentPath, worktreePath, worktreeName)
      if (!worktreeResult.success) {
        return worktreeResult
      }

      // 获取当前提交信息
      const commitResult = await execGit(['rev-parse', 'HEAD'], parentPath)
      const commit = commitResult.stdout.trim()

      // 存储 worktree 信息
      const worktreeInfo: WorktreeInfo = {
        path: worktreePath,
        branch: worktreeName,
        commit
      }
      this.worktrees.set(worktreeName, worktreeInfo)

      // 复制额外文件（如果需要）
      if (mergedConfig.inheritFiles && mergedConfig.additionalPatterns) {
        await this.copyAdditionalFiles(parentPath, worktreePath, mergedConfig)
      }

      // 创建隔离上下文
      const context: IsolatedContext = {
        workPath: worktreePath,
        parentPath: resolve(parentPath),
        mode: 'worktree',
        cleanup: () => this.cleanup(worktreeName),
        isCleaned: false,
        createdAt: Date.now()
      }

      this.logger.info('Worktree isolation context created', {
        worktreePath,
        branch: worktreeName,
        commit: commit.slice(0, 8)
      })

      this.emit('context:created', { worktreeName, context })

      return {
        success: true,
        context
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Failed to create worktree isolation', { error: errorMessage })
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 创建 Git worktree
   */
  private async createWorktree(
    parentPath: string,
    worktreePath: string,
    branchName: string
  ): Promise<IsolationResult> {
    try {
      // 检查工作树是否已存在
      const listResult = await execGit(['worktree', 'list'], parentPath)
      if (listResult.stdout.includes(worktreePath)) {
        // 已存在，先移除
        await execGit(['worktree', 'remove', '-f', worktreePath], parentPath)
      }

      // 创建新的 worktree
      // -b: 创建新分支
      // --detach: 分离 HEAD（不跟踪远程分支）
      const result = await execGit(
        ['worktree', 'add', '-b', branchName, worktreePath, '--detach'],
        parentPath,
        60000 // 60 秒超时
      )

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to create worktree: ${result.stderr}`
        }
      }

      // 验证工作树创建成功
      if (!(await validateDirectory(worktreePath))) {
        return {
          success: false,
          error: 'Worktree directory was not created'
        }
      }

      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 复制额外文件到 worktree
   */
  private async copyAdditionalFiles(
    parentPath: string,
    worktreePath: string,
    config: IsolationConfig
  ): Promise<void> {
    // worktree 已经复制了 Git 跟踪的文件
    // 这里只复制未跟踪但需要继承的文件
    const { additionalPatterns = [], excludePatterns = [] } = config

    // 复制额外的文件（如配置文件、环境变量等）
    for (const pattern of additionalPatterns) {
      try {
        const sourcePath = join(parentPath, pattern)
        const destPath = join(worktreePath, pattern)
        
        const stats = await fs.stat(sourcePath).catch(() => null)
        if (stats?.isFile()) {
          await fs.copyFile(sourcePath, destPath)
        }
      } catch (error) {
        this.logger.warn(`Failed to copy additional file: ${pattern}`, { error })
      }
    }
  }

  /**
   * 清理 worktree
   */
  async cleanup(worktreeName: string): Promise<void> {
    const worktreeInfo = this.worktrees.get(worktreeName)
    if (!worktreeInfo) {
      this.logger.warn(`Worktree not found: ${worktreeName}`)
      return
    }

    this.logger.info('Cleaning up worktree', { worktreeName, path: worktreeInfo.path })

    try {
      // 获取父目录（Git 主仓库）
      const parentPath = this.findParentPath(worktreeInfo.path)
      
      if (parentPath) {
        // 移除 worktree
        const result = await execGit(
          ['worktree', 'remove', '-f', worktreeInfo.path],
          parentPath,
          30000
        )

        if (result.exitCode !== 0) {
          this.logger.warn('Failed to remove worktree via git', { error: result.stderr })
          // 尝试强制删除目录
          await safeRemoveDir(worktreeInfo.path)
        }

        // 删除分支
        await execGit(['branch', '-D', worktreeInfo.branch], parentPath)
      } else {
        // 无法找到父目录，直接删除
        await safeRemoveDir(worktreeInfo.path)
      }

      this.worktrees.delete(worktreeName)
      this.emit('context:cleaned', { worktreeName })
      this.logger.info('Worktree cleaned up', { worktreeName })

    } catch (error) {
      this.logger.error('Error during worktree cleanup', { error, worktreeName })
      // 即使出错也尝试删除目录
      await safeRemoveDir(worktreeInfo.path)
    }
  }

  /**
   * 清理所有 worktree
   */
  async cleanupAll(): Promise<void> {
    this.logger.info(`Cleaning up all worktrees (${this.worktrees.size} total)`)
    
    const promises = Array.from(this.worktrees.keys()).map(name => this.cleanup(name))
    await Promise.all(promises)
  }

  /**
   * 查找父目录（通过检查 Git 仓库）
   */
  private findParentPath(worktreePath: string): string | null {
    // 简化处理：尝试向上查找 .git 目录
    // 实际项目中可能需要更复杂的逻辑
    return null
  }

  /**
   * 获取所有活动的 worktree
   */
  getActiveWorktrees(): WorktreeInfo[] {
    return Array.from(this.worktrees.values())
  }

  /**
   * 检查 worktree 是否活动
   */
  isActive(worktreeName: string): boolean {
    return this.worktrees.has(worktreeName)
  }
}

// 导出单例
export const worktreeIsolation = new WorktreeIsolation()
