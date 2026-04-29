/**
 * Structured Logger for API Service
 *
 * 输出 JSON 格式日志，自动注入 trace_id / span_id
 * 兼容 Loki 解析规则
 * 自动脱敏敏感信息：密码、连接串、Secret、Token、API Key
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

// 脱敏规则：匹配并替换敏感信息
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // PostgreSQL 连接串：postgresql://user:password@host/db
  {
    pattern: /(postgresql|postgres):\/\/[^:]+:[^@]+@/gi,
    replacement: '$1://***:***@',
  },
  // Redis URL：redis://:password@host 或 redis://user:password@host
  {
    pattern: /(redis|rediss):\/\/([^@]*@)?/gi,
    replacement: '$1://***:***@',
  },
  // JWT Secret / 通用 Secret（作为独立值）
  {
    pattern: /\b(secret|jwt_secret|jwtsecret|jwtsecretkey)\s*[:=]\s*["']?[^\s"',}&\]]{8,}["']?/gi,
    replacement: '$1: ***',
  },
  // API Key（以 sk-、ak- 开头，或包含 api_key 字段）
  {
    pattern: /\b(api[_-]?key|apikey)\s*[:=]\s*["']?[^\s"',}&\]]{8,}["']?/gi,
    replacement: '$1: ***',
  },
  // OpenAI / Ollama / LLM 密钥（sk-xxx, pk-xxx）
  {
    pattern: /\b(sk-[a-zA-Z0-9]{20,}|pk-[a-zA-Z0-9]{20,})\b/g,
    replacement: '***',
  },
  // 密码字段（password, pwd）
  {
    pattern: /\b(password|pwd)\s*[:=]\s*["']?[^\s"',}&\]]{1,}["']?/gi,
    replacement: '$1: ***',
  },
  // Bearer Token
  {
    pattern: /\b(Bearer\s+)[a-zA-Z0-9_\-\.]{20,}/g,
    replacement: '$1***',
  },
  // 连接串中的 host:port 后的密码（兜底）
  {
    pattern: /:\/\/[^:]+:[^@]+@/g,
    replacement: '://***:***@',
  },
];

function sanitizeString(input: string): string {
  let result = input;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // 对已知敏感键直接脱敏，无论值类型
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('jwt') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('credential')
      ) {
        sanitized[key] = typeof val === 'string' && val.length > 0 ? '***' : val;
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }
  return value;
}

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
    message: sanitizeString(message),
    trace_id: getCurrentTraceId(),
    span_id: getCurrentSpanId(),
  };

  if (meta?.context) {
    entry.context = sanitizeValue(meta.context) as Record<string, unknown>;
  }

  if (meta?.duration_ms !== undefined) {
    entry.duration_ms = meta.duration_ms;
  }

  if (meta?.error) {
    entry.error = {
      message: sanitizeString(meta.error.message),
      stack: meta.error.stack ? sanitizeString(meta.error.stack) : undefined,
      code: (meta.error as any).code,
    };
  }

  return entry;
}

function output(entry: LogEntry): void {
  const logLine = JSON.stringify(entry) + '\n';
  if (entry.level === 'error') {
    process.stderr.write(logLine);
  } else {
    process.stdout.write(logLine);
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
