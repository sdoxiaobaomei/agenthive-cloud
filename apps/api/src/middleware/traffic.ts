/**
 * Traffic Tracking Middleware
 *
 * Records PV (+1 per request) and UV dedup via IP+UA hash.
 * Applied to hosted website routes (/h/:projectId/*).
 */

import type { Request, Response, NextFunction } from 'express'
import { recordPageView } from '../project/traffic-service.js'
import logger from '../utils/logger.js'

export function trafficTracker() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const projectId = req.params.projectId
    if (!projectId) {
      return next()
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const userAgent = req.get('user-agent') || 'unknown'

    try {
      await recordPageView(projectId, ip, userAgent)
    } catch (err) {
      logger.warn('Traffic tracking failed', {
        projectId,
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    next()
  }
}

/**
 * Hosted Site Mock Handler
 *
 * In mock mode, serves a placeholder HTML page for hosted projects.
 * Actual static file serving will be handled by Nginx / Platform later.
 */
export function hostedSiteMockHandler() {
  return (req: Request, res: Response) => {
    const projectId = req.params.projectId
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hosted Project ${projectId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 480px; text-align: center; }
    h1 { font-size: 1.25rem; color: #333; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 0.875rem; }
    .badge { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Project ${projectId}</h1>
    <p>This site is hosted via AgentHive Cloud.</p>
    <span class="badge">[MOCK MODE]</span>
  </div>
</body>
</html>`)
  }
}
