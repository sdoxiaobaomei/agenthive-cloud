/**
 * WebSocket Telemetry Bridge（已移除 OpenTelemetry SDK）
 *
 * 保留函数签名以兼容现有调用方，内部不再创建 spans。
 * 可观测性由 Beyla (eBPF) 无侵入覆盖。
 */

import type { Socket } from 'socket.io'
import { extractTraceContextFromPayload } from '@agenthive/observability'

const TRACER_NAME = 'agenthive-api-websocket'

/**
 * 从 Socket.IO handshake headers 提取 trace context（保留 API 兼容性）
 */
export function extractTraceContextFromHandshake(socket: Socket): undefined {
  // Beyla 会自动从 HTTP handshake 中提取 trace context
  // 应用层不再需要手动处理
  return undefined
}

/**
 * 存储 trace context 到 socket data（保留 API 兼容性，现为空操作）
 */
export function storeTraceContext(_socket: Socket, _ctx: unknown): void {
  // No-op: Beyla handles context propagation at kernel level
}

/**
 * 从 socket data 恢复 trace context（保留 API 兼容性，现为空操作）
 */
export function restoreTraceContext(_socket: Socket): undefined {
  return undefined
}

/**
 * 为 WebSocket 事件创建 span（保留 API 兼容性，内部改为直接执行操作）
 */
export function withSocketSpan<T>(
  _socket: Socket,
  _eventName: string,
  operation: () => T | Promise<T>
): Promise<T> | T {
  return operation()
}
