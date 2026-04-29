/**
 * Traffic Service - PV/UV tracking and batch reporting
 *
 * Features:
 * - Record PV (+1 per request)
 * - UV dedup via IP+UA hash (Redis Set, TTL 1h)
 * - Batch report every 5 min to Java API
 * - Dashboard data: 7-day trend and realtime stats
 */

import { createHash } from 'crypto'
import { redis, key } from '../config/redis.js'
import logger from '../utils/logger.js'
import {
  notifyJavaTraffic,
  fetchTrafficTrendFromJava,
  fetchRealtimeTrafficFromJava,
  MOCK_JAVA_API,
} from './hosting-service.js'

// ─── Types ───
export interface TrafficSnapshot {
  projectId: string
  pv: number
  uv: number
  timestamp: Date
}

export interface DailyTraffic {
  date: string
  pv: number
  uv: number
}

// ─── In-memory queue for failed reports ───
const pendingReports: Array<{ projectId: string; pvCount: number; uvCount: number; timestamp: string }> = []

// ─── Redis Key Helpers ───

function pvKey(projectId: string, date: string): string {
  return key('traffic', `pv:${projectId}:${date}`)
}

function uvSetKey(projectId: string, hourBucket: string): string {
  return key('traffic', `uv:${projectId}:${hourBucket}`)
}

function getHourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13) // "2024-01-15T10"
}

function getDateStr(d = new Date()): string {
  return d.toISOString().slice(0, 10) // "2024-01-15"
}

// ─── Visitor Fingerprint ───

function makeFingerprint(ip: string, userAgent: string): string {
  return createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').slice(0, 32)
}

// ─── Record Traffic ───

export async function recordPageView(
  projectId: string,
  ip: string,
  userAgent: string
): Promise<void> {
  const date = getDateStr()
  const hourBucket = getHourBucket()
  const fingerprint = makeFingerprint(ip, userAgent)

  const pipeline = redis.pipeline()
  // PV: increment daily counter
  pipeline.incr(pvKey(projectId, date))
  pipeline.expire(pvKey(projectId, date), 86400) // 24h TTL
  // UV: add fingerprint to hourly set
  pipeline.sadd(uvSetKey(projectId, hourBucket), fingerprint)
  pipeline.expire(uvSetKey(projectId, hourBucket), 3600) // 1h TTL

  try {
    await pipeline.exec()
  } catch (err) {
    logger.warn('Traffic recording failed', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── Read Traffic ───

export async function getRealtimeTraffic(projectId: string): Promise<{ pv: number; uv: number }> {
  const date = getDateStr()
  const hourBucket = getHourBucket()

  try {
    const [pvStr, uvMembers] = await Promise.all([
      redis.get(pvKey(projectId, date)),
      redis.smembers(uvSetKey(projectId, hourBucket)),
    ])
    const pv = parseInt(pvStr || '0', 10)
    const uv = uvMembers.length
    return { pv, uv }
  } catch (err) {
    logger.warn('Realtime traffic read failed', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { pv: 0, uv: 0 }
  }
}

// ─── Mock Data Generator ───

function generateMockTrend(days: number): DailyTraffic[] {
  const result: DailyTraffic[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    // Deterministic pseudo-random based on date string
    const seed = date.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const pv = 100 + (seed % 400)
    const uv = Math.floor(pv * (0.4 + (seed % 30) / 100))
    result.push({ date, pv, uv })
  }
  return result
}

function generateMockRealtime(): { pv: number; uv: number } {
  const hour = new Date().getHours()
  const pv = 50 + (hour * 10) % 200
  const uv = Math.floor(pv * 0.6)
  return { pv, uv }
}

// ─── Dashboard APIs ───

export async function getTrafficTrend(projectId: string, days = 7): Promise<DailyTraffic[]> {
  const javaData = await fetchTrafficTrendFromJava(projectId, days)
  if (javaData) {
    return javaData.map((d: any) => ({
      date: d.date || d.timestamp,
      pv: d.pv || d.pvCount || 0,
      uv: d.uv || d.uvCount || 0,
    }))
  }

  if (MOCK_JAVA_API) {
    logger.info('[MOCK] Returning mock traffic trend', { projectId, days })
    return generateMockTrend(days)
  }

  // Fallback: build from Redis if Java is down but we have local data
  const result: DailyTraffic[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    try {
      const pvStr = await redis.get(pvKey(projectId, date))
      const pv = parseInt(pvStr || '0', 10)
      result.push({ date, pv, uv: 0 }) // UV aggregation across hours is expensive; skip for fallback
    } catch {
      result.push({ date, pv: 0, uv: 0 })
    }
  }
  return result
}

export async function getRealtimeTrafficWithFallback(projectId: string): Promise<{ pv: number; uv: number }> {
  const javaData = await fetchRealtimeTrafficFromJava(projectId)
  if (javaData) return javaData

  if (MOCK_JAVA_API) {
    logger.info('[MOCK] Returning mock realtime traffic', { projectId })
    return generateMockRealtime()
  }

  return getRealtimeTraffic(projectId)
}

// ─── Batch Reporter ───

async function aggregateTrafficForReport(): Promise<Map<string, { pv: number; uv: number }>> {
  const aggregated = new Map<string, { pv: number; uv: number }>()
  const date = getDateStr()

  try {
    // Scan for all PV keys today
    const pvPattern = key('traffic', `pv:*:${date}`)
    const pvKeys = await redis.keys(pvPattern)

    for (const pk of pvKeys) {
      const match = pk.match(/pv:([^:]+):/)
      if (!match) continue
      const projectId = match[1]
      const pvStr = await redis.get(pk)
      const pv = parseInt(pvStr || '0', 10)
      aggregated.set(projectId, { pv, uv: 0 })
    }

    // Scan for all UV keys in the last hour
    const hourBucket = getHourBucket()
    const uvPattern = key('traffic', `uv:*:${hourBucket}`)
    const uvKeys = await redis.keys(uvPattern)

    for (const uk of uvKeys) {
      const match = uk.match(/uv:([^:]+):/)
      if (!match) continue
      const projectId = match[1]
      const members = await redis.smembers(uk)
      const existing = aggregated.get(projectId)
      if (existing) {
        existing.uv = members.length
      } else {
        aggregated.set(projectId, { pv: 0, uv: members.length })
      }
    }
  } catch (err) {
    logger.warn('Traffic aggregation failed', { error: err instanceof Error ? err.message : String(err) })
  }

  return aggregated
}

export async function runBatchReport(): Promise<void> {
  // Flush pending reports first
  while (pendingReports.length > 0) {
    const report = pendingReports.shift()!
    const ok = await notifyJavaTraffic(report.projectId, {
      pvCount: report.pvCount,
      uvCount: report.uvCount,
      timestamp: report.timestamp,
    })
    if (!ok) {
      // Re-queue if still failing (with max retry guard)
      pendingReports.push(report)
      break // Stop flushing to avoid infinite loop
    }
  }

  const aggregated = await aggregateTrafficForReport()
  const timestamp = new Date().toISOString()

  for (const [projectId, { pv, uv }] of aggregated.entries()) {
    if (pv === 0 && uv === 0) continue

    const ok = await notifyJavaTraffic(projectId, { pvCount: pv, uvCount: uv, timestamp })
    if (!ok) {
      pendingReports.push({ projectId, pvCount: pv, uvCount: uv, timestamp })
      logger.warn('Traffic report queued for retry', { projectId, pv, uv })
    }
  }

  if (aggregated.size > 0 || pendingReports.length > 0) {
    logger.info('Batch traffic report completed', {
      projectsReported: aggregated.size,
      pendingRetries: pendingReports.length,
    })
  }
}

// ─── Background Interval ───

const BATCH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
let reporterInterval: ReturnType<typeof setInterval> | null = null

export function startBatchReporter(): void {
  if (reporterInterval) return
  reporterInterval = setInterval(() => {
    runBatchReport().catch((err) => {
      logger.error('Batch reporter error', err instanceof Error ? err : undefined)
    })
  }, BATCH_INTERVAL_MS)
  logger.info('Traffic batch reporter started', { intervalMinutes: 5 })
}

export function stopBatchReporter(): void {
  if (reporterInterval) {
    clearInterval(reporterInterval)
    reporterInterval = null
    logger.info('Traffic batch reporter stopped')
  }
}
