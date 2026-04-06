/**
 * Agent Isolation Types
 * 
 * 定义代理隔离的配置和结果类型
 * 参考 Claude Code 的隔离模式设计
 */

export type IsolationMode = 'worktree' | 'temp' | 'container' | 'none'

export interface IsolationConfig {
  /** 隔离模式 */
  mode: IsolationMode
  /** 是否继承父上下文的文件 */
  inheritFiles: boolean
  /** 是否保留 Git 历史 */
  preserveGit: boolean
  /** 是否复制 node_modules */
  copyNodeModules: boolean
  /** 额外的复制模式 */
  additionalPatterns?: string[]
  /** 排除模式 */
  excludePatterns?: string[]
  /** 环境变量覆盖 */
  env?: Record<string, string>
  /** 工作目录 */
  cwd?: string
}

export interface IsolatedContext {
  /** 隔离工作目录路径 */
  workPath: string
  /** 原始父目录路径 */
  parentPath: string
  /** 隔离模式 */
  mode: IsolationMode
  /** 清理函数 - 必须在完成后调用 */
  cleanup: () => Promise<void>
  /** 是否已清理 */
  isCleaned: boolean
  /** 创建时间 */
  createdAt: number
}

export interface IsolationResult {
  success: boolean
  context?: IsolatedContext
  error?: string
}

export interface WorktreeInfo {
  path: string
  branch: string
  commit: string
}

// 默认隔离配置
export const DEFAULT_ISOLATION_CONFIG: IsolationConfig = {
  mode: 'temp',
  inheritFiles: true,
  preserveGit: false,
  copyNodeModules: false,
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.cache',
    '*.log'
  ]
}

// 工作树隔离配置
export const WORKTREE_ISOLATION_CONFIG: IsolationConfig = {
  ...DEFAULT_ISOLATION_CONFIG,
  mode: 'worktree',
  preserveGit: true
}
