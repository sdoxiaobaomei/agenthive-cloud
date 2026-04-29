/**
 * Hosting Service - Deploy workspace to hosting environment
 *
 * Features:
 * - Generate deploy config (Dockerfile / Nginx config / static file list)
 * - Call Java /hosted-websites API (mock fallback when unavailable)
 * - Track deployment state in PostgreSQL
 */

import { pool } from '../config/database.js'
import { redis, key } from '../config/redis.js'
import logger from '../utils/logger.js'
import { readdir } from 'fs/promises'
import { join, extname } from 'path'

// ─── Configuration ───
const JAVA_GATEWAY_URL = process.env.JAVA_GATEWAY_URL || 'http://localhost:8080'
export const MOCK_JAVA_API = process.env.MOCK_JAVA_API === 'true'
const HOSTING_DOMAIN = process.env.HOSTING_DOMAIN || 'agenthive.io'

// ─── Types ───
export interface DeployConfig {
  dockerfile: string
  nginxConfig: string
  staticFiles: string[]
}

export interface DeploymentRecord {
  id: string
  project_id: string
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'stopped'
  access_url: string
  config_json: DeployConfig
  created_at: string
  updated_at: string
}

// ─── Helpers ───

function getAccessUrl(projectId: string): string {
  return `https://${projectId}.${HOSTING_DOMAIN}`
}

async function callJavaApi<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T | null> {
  if (MOCK_JAVA_API) {
    logger.info('[MOCK] Would call Java API', { endpoint, method: options.method || 'GET' })
    return null
  }

  const url = `${JAVA_GATEWAY_URL}${endpoint}`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      logger.warn('Java API returned error', { endpoint, status: res.status })
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    logger.warn('Java API unavailable, falling back to mock', { endpoint, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ─── Deploy Config Generation ───

export async function generateDeployConfig(
  projectId: string,
  workspacePath: string,
  techStack?: string
): Promise<DeployConfig> {
  const stack = techStack || 'static'
  const isStatic = ['html', 'static', 'vue', 'react', 'nuxt'].some((s) => stack.includes(s))

  let dockerfile = ''
  if (isStatic) {
    dockerfile = `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
`
  } else {
    dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
`
  }

  const nginxConfig = `server {
  listen 80;
  server_name ${projectId}.${HOSTING_DOMAIN};
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  error_page 404 /404.html;
}
`

  let staticFiles: string[] = []
  try {
    const entries = await readdir(workspacePath, { withFileTypes: true })
    staticFiles = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => ['.html', '.css', '.js', '.png', '.jpg', '.svg', '.json'].includes(extname(name)))
  } catch {
    staticFiles = ['index.html']
  }

  if (staticFiles.length === 0) staticFiles = ['index.html']

  return { dockerfile, nginxConfig, staticFiles }
}

// ─── Deployment CRUD ───

export async function findDeployment(projectId: string): Promise<DeploymentRecord | undefined> {
  const result = await pool.query(
    'SELECT * FROM project_deployments WHERE project_id = $1',
    [projectId]
  )
  return result.rows[0] || undefined
}

export async function createDeploymentRecord(
  projectId: string,
  config: DeployConfig
): Promise<DeploymentRecord> {
  const accessUrl = getAccessUrl(projectId)
  const result = await pool.query(
    `INSERT INTO project_deployments (project_id, status, access_url, config_json)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id) DO UPDATE SET
       status = EXCLUDED.status,
       access_url = EXCLUDED.access_url,
       config_json = EXCLUDED.config_json,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [projectId, 'deploying', accessUrl, JSON.stringify(config)]
  )
  return result.rows[0]
}

export async function updateDeploymentStatus(
  projectId: string,
  status: DeploymentRecord['status']
): Promise<void> {
  await pool.query(
    `UPDATE project_deployments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE project_id = $2`,
    [status, projectId]
  )
}

export async function deleteDeploymentRecord(projectId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM project_deployments WHERE project_id = $1',
    [projectId]
  )
  return (result.rowCount ?? 0) > 0
}

// ─── Java API Integration ───

interface HostedWebsitePayload {
  projectId: string
  accessUrl: string
  config: DeployConfig
}

export async function notifyJavaCreateHostedWebsite(payload: HostedWebsitePayload): Promise<boolean> {
  const res = await callJavaApi('/hosted-websites', {
    method: 'POST',
    body: payload,
  })
  if (res === null && MOCK_JAVA_API) {
    logger.info('[MOCK] Would create hosted website', { projectId: payload.projectId })
    return true
  }
  return res !== null
}

export async function notifyJavaDeleteHostedWebsite(projectId: string): Promise<boolean> {
  const res = await callJavaApi(`/hosted-websites/${projectId}`, {
    method: 'DELETE',
  })
  if (res === null && MOCK_JAVA_API) {
    logger.info('[MOCK] Would delete hosted website', { projectId })
    return true
  }
  return res !== null
}

export async function notifyJavaTraffic(projectId: string, payload: { pvCount: number; uvCount: number; timestamp: string }): Promise<boolean> {
  const res = await callJavaApi(`/hosted-websites/${projectId}/traffic`, {
    method: 'POST',
    body: payload,
  })
  if (res === null && MOCK_JAVA_API) {
    logger.info('[MOCK] Would report traffic', { projectId, ...payload })
    return true
  }
  return res !== null
}

export async function fetchTrafficTrendFromJava(projectId: string, days: number): Promise<any[] | null> {
  const res = await callJavaApi<any[]>(`/hosted-websites/${projectId}/traffic/trend?days=${days}`)
  return res
}

export async function fetchRealtimeTrafficFromJava(projectId: string): Promise<{ pv: number; uv: number } | null> {
  const res = await callJavaApi<{ pv: number; uv: number }>(`/hosted-websites/${projectId}/traffic/realtime`)
  return res
}

// ─── High-level Operations ───

export async function deployProject(
  projectId: string,
  workspacePath: string,
  techStack?: string
): Promise<{ accessUrl: string; status: string; mock: boolean }> {
  const config = await generateDeployConfig(projectId, workspacePath, techStack)
  await createDeploymentRecord(projectId, config)

  const javaOk = await notifyJavaCreateHostedWebsite({
    projectId,
    accessUrl: getAccessUrl(projectId),
    config,
  })

  const status = javaOk ? 'deployed' : 'failed'
  await updateDeploymentStatus(projectId, status)

  return {
    accessUrl: getAccessUrl(projectId),
    status,
    mock: !javaOk || MOCK_JAVA_API,
  }
}

export async function stopDeployment(projectId: string): Promise<{ success: boolean; mock: boolean }> {
  const javaOk = await notifyJavaDeleteHostedWebsite(projectId)
  await deleteDeploymentRecord(projectId)

  // 清理 Redis 中的流量数据
  try {
    const pattern = key('traffic', `${projectId}:*`)
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (err) {
    logger.warn('Failed to clean up Redis traffic keys', { projectId, error: err instanceof Error ? err.message : String(err) })
  }

  return {
    success: true,
    mock: !javaOk || MOCK_JAVA_API,
  }
}
