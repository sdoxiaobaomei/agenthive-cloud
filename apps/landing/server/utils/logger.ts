/**
 * Nitro Server Logger - 结构化日志
 * 
 * 用于 Landing SSR 服务端，输出 JSON 格式兼容 Loki
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: Record<string, unknown>;
}

const SERVICE_NAME = 'agenthive-landing';
const MIN_LEVEL = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function output(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') console.error(line);
  else if (entry.level === 'warn') console.warn(line);
  else console.log(line);
}

export const serverLogger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('debug')) return;
    output({ timestamp: new Date().toISOString(), level: 'debug', service: SERVICE_NAME, message, context });
  },
  info(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('info')) return;
    output({ timestamp: new Date().toISOString(), level: 'info', service: SERVICE_NAME, message, context });
  },
  warn(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('warn')) return;
    output({ timestamp: new Date().toISOString(), level: 'warn', service: SERVICE_NAME, message, context });
  },
  error(message: string, error?: Error, context?: Record<string, unknown>) {
    if (!shouldLog('error')) return;
    output({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: SERVICE_NAME,
      message,
      context: { ...context, error: error?.message, stack: error?.stack },
    });
  },
};

export default serverLogger;
