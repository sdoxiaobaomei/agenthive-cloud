// 日志工具
export class Logger {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level}] [${this.prefix}] ${message}${metaStr}`
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatMessage('INFO', message, meta))
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage('WARN', message, meta))
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage('ERROR', message, meta))
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, meta))
    }
  }
}
