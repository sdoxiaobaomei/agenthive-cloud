/**
 * Express Request Logger Middleware
 * 
 * 记录每个 HTTP 请求的结构化日志，包含 trace_id 和 duration
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.request({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        user_agent: req.get('user-agent'),
        ip: req.ip,
      });
    });

    next();
  };
}

export default requestLogger;
