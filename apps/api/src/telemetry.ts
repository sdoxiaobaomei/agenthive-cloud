/**
 * Telemetry 占位符（已移除 OpenTelemetry SDK）
 *
 * 可观测性由 Beyla (eBPF DaemonSet) 无侵入覆盖：
 * - HTTP/Express 请求自动追踪
 * - PostgreSQL 查询自动追踪
 * - Redis 命令自动追踪
 * - WebSocket 帧自动追踪
 *
 * 应用内自定义事件使用结构化日志（logger.info/error）输出，
 * 由 Loki 采集后在 Grafana 中关联展示。
 */

import logger from './utils/logger.js'

logger.info('[Telemetry] Running in Beyla mode (eBPF-based, zero-instrumentation)')

// 占位导出，兼容旧 import
export default {}
