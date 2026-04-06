/**
 * Enhanced Logger - 结构化日志系统
 * 
 * 参考 Claude Code 设计：
 * 1. 结构化日志输出（JSON 格式）
 * 2. 多级别日志控制
 * 3. 日志分类和标签
 * 4. 上下文关联
 * 5. 性能指标记录
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogCategory = 
  | 'system' 
  | 'agent' 
  | 'tool' 
  | 'llm' 
  | 'mcp' 
  | 'permission' 
  | 'performance'
  | 'security'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  category: LogCategory
  prefix: string
  context?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    code?: string
  }
  duration?: number
  metadata?: Record<string, unknown>
}

export interface LoggerConfig {
  minLevel: LogLevel
  structured: boolean
  includeTimestamp: boolean
  colorize: boolean
  output?: (entry: LogEntry) => void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',  // Cyan
  info: '\x1b[32m',   // Green
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m',  // Red
  fatal: '\x1b[35m'   // Magenta
}

const RESET_COLOR = '\x1b[0m'

class LoggerInstance {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel: config.minLevel || this.getLevelFromEnv(),
      structured: config.structured ?? false,
      includeTimestamp: config.includeTimestamp ?? true,
      colorize: config.colorize ?? this.shouldColorize(),
      output: config.output
    }
  }

  private getLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
    if (envLevel && envLevel in LOG_LEVELS) {
      return envLevel
    }
    return process.env.DEBUG ? 'debug' : 'info'
  }

  private shouldColorize(): boolean {
    // 非 TTY 环境禁用颜色
    if (process.env.NO_COLOR) return false
    if (process.env.CI) return false
    return process.stdout.isTTY ?? false
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
  }

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private formatConsole(entry: LogEntry): string {
    const parts: string[] = []

    if (this.config.includeTimestamp) {
      parts.push(`[${entry.timestamp}]`)
    }

    const levelStr = this.config.colorize 
      ? `${LEVEL_COLORS[entry.level]}[${entry.level.toUpperCase()}]${RESET_COLOR}`
      : `[${entry.level.toUpperCase()}]`
    parts.push(levelStr)

    parts.push(`[${entry.category}]`)
    parts.push(`[${entry.prefix}]`)
    parts.push(entry.message)

    if (entry.duration !== undefined) {
      parts.push(`(${entry.duration}ms)`)
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context))
    }

    if (entry.error) {
      parts.push(`\n  Error: ${entry.error.message}`)
      if (entry.error.stack && this.config.minLevel === 'debug') {
        parts.push(`\n  Stack: ${entry.error.stack}`)
      }
    }

    return parts.join(' ')
  }

  private output(entry: LogEntry): void {
    if (this.config.output) {
      this.config.output(entry)
      return
    }

    if (this.config.structured) {
      console.log(JSON.stringify(entry))
    } else {
      const formatted = this.formatConsole(entry)
      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(formatted)
      } else if (entry.level === 'warn') {
        console.warn(formatted)
      } else {
        console.log(formatted)
      }
    }
  }

  log(
    level: LogLevel,
    category: LogCategory,
    prefix: string,
    message: string,
    meta?: {
      context?: Record<string, unknown>
      error?: Error
      duration?: number
      metadata?: Record<string, unknown>
    }
  ): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      category,
      prefix,
      message,
      context: meta?.context,
      duration: meta?.duration,
      metadata: meta?.metadata
    }

    if (meta?.error) {
      entry.error = {
        message: meta.error.message,
        stack: meta.error.stack,
        code: (meta.error as any).code
      }
    }

    this.output(entry)
  }

  // Convenience methods
  debug(category: LogCategory, prefix: string, message: string, context?: Record<string, unknown>): void {
    this.log('debug', category, prefix, message, { context })
  }

  info(category: LogCategory, prefix: string, message: string, context?: Record<string, unknown>): void {
    this.log('info', category, prefix, message, { context })
  }

  warn(category: LogCategory, prefix: string, message: string, context?: Record<string, unknown>): void {
    this.log('warn', category, prefix, message, { context })
  }

  error(category: LogCategory, prefix: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', category, prefix, message, { error, context })
  }

  fatal(category: LogCategory, prefix: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('fatal', category, prefix, message, { error, context })
  }

  // Performance logging
  performance(prefix: string, operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.log('info', 'performance', prefix, operation, { duration, metadata })
  }

  // Security logging
  security(prefix: string, message: string, context?: Record<string, unknown>): void {
    this.log('warn', 'security', prefix, message, { context })
  }
}

// Global logger instance
const globalLogger = new LoggerInstance()

/**
 * Enhanced Logger class for components
 */
export class Logger {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  debug(message: string, context?: Record<string, unknown>): void {
    globalLogger.debug('system', this.prefix, message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    globalLogger.info('system', this.prefix, message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    globalLogger.warn('system', this.prefix, message, context)
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    globalLogger.error('system', this.prefix, message, error, context)
  }

  // Category-specific loggers
  agent(message: string, context?: Record<string, unknown>): void {
    globalLogger.info('agent', this.prefix, message, context)
  }

  tool(message: string, context?: Record<string, unknown>): void {
    globalLogger.info('tool', this.prefix, message, context)
  }

  llm(message: string, context?: Record<string, unknown>): void {
    globalLogger.info('llm', this.prefix, message, context)
  }

  mcp(message: string, context?: Record<string, unknown>): void {
    globalLogger.info('mcp', this.prefix, message, context)
  }

  permission(message: string, context?: Record<string, unknown>): void {
    globalLogger.info('permission', this.prefix, message, context)
  }

  performance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    globalLogger.performance(this.prefix, operation, duration, metadata)
  }

  security(message: string, context?: Record<string, unknown>): void {
    globalLogger.security(this.prefix, message, context)
  }
}

/**
 * Create a logger with custom configuration
 */
export function createLogger(prefix: string, config?: Partial<LoggerConfig>): Logger {
  // If custom config needed, we could extend Logger to use custom instance
  return new Logger(prefix)
}

/**
 * Configure global logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  Object.assign(globalLogger, config)
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(parent: Logger, additionalPrefix: string): Logger {
  return new Logger(`${parent['prefix']}:${additionalPrefix}`)
}

export { globalLogger }
export default Logger
