/**
 * Structured Logger for API Service
 * 
 * 输出 JSON 格式日志，自动注入 trace_id / span_id
 * 兼容 Loki 解析规则
 */

import { getCurrentTraceId, getCurrentSpanId } from '@agenthive/observability';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  duration_ms?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SERVICE_NAME = 'agenthive-api';
const MIN_LEVEL = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function buildLogEntry(
  level: LogLevel,
  message: string,
  meta?: {
    context?: Record<string, unknown>;
    error?: Error;
    duration_ms?: number;
  }
): LogEntry {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    service: SERVICE_NAME,
    message,
    trace_id: getCurrentTraceId(),
    span_id: getCurrentSpanId(),
  };

  if (meta?.context) {
    entry.context = meta.context;
  }

  if (meta?.duration_ms !== undefined) {
    entry.duration_ms = meta.duration_ms;
  }

  if (meta?.error) {
    entry.error = {
      message: meta.error.message,
      stack: meta.error.stack,
      code: (meta.error as any).code,
    };
  }

  return entry;
}

function output(entry: LogEntry): void {
  const logLine = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(logLine);
  } else if (entry.level === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (!shouldLog('debug')) return;
    output(buildLogEntry('debug', message, { context }));
  },

  info(message: string, context?: Record<string, unknown>): void {
    if (!shouldLog('info')) return;
    output(buildLogEntry('info', message, { context }));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    if (!shouldLog('warn')) return;
    output(buildLogEntry('warn', message, { context }));
  },

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!shouldLog('error')) return;
    output(buildLogEntry('error', message, { error, context }));
  },

  // 请求日志专用
  request(req: {
    method: string;
    path: string;
    status: number;
    duration_ms: number;
    user_agent?: string;
    ip?: string;
    error?: Error;
  }): void {
    const level: LogLevel = req.status >= 500 ? 'error' : req.status >= 400 ? 'warn' : 'info';
    if (!shouldLog(level)) return;

    const entry = buildLogEntry(level, `${req.method} ${req.path} ${req.status}`, {
      duration_ms: req.duration_ms,
      error: req.error,
      context: {
        http_method: req.method,
        http_path: req.path,
        http_status: req.status,
        user_agent: req.user_agent,
        client_ip: req.ip,
      },
    });

    output(entry);
  },
};

export default logger;
