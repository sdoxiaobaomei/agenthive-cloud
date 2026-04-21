/**
 * WebSocket ↔ OpenTelemetry Context Bridge
 * 
 * Socket.IO 连接建立时从 HTTP handshake 提取 traceparent，
 * 在后续 WebSocket 事件处理中恢复 parent span。
 */

import { trace, context, type Span, type Context } from '@opentelemetry/api';
import type { Socket } from 'socket.io';
import {
  extractTraceContextFromPayload,
  injectTraceContextIntoPayload,
  getCurrentTraceId,
  AI_SPAN_NAMES,
} from '@agenthive/observability';

const TRACER_NAME = 'agenthive-api-websocket';

/**
 * 从 Socket.IO handshake headers 提取 trace context
 */
export function extractTraceContextFromHandshake(socket: Socket): Context | undefined {
  const traceparent = socket.handshake.headers['traceparent'] as string | undefined;
  const tracestate = socket.handshake.headers['tracestate'] as string | undefined;

  if (!traceparent) {
    return undefined;
  }

  // 手动构造 carrier 并提取
  const carrier: Record<string, string> = { traceparent };
  if (tracestate) {
    carrier.tracestate = tracestate;
  }

  return context.active(); // propagation.extract 会在调用处处理
}

/**
 * 存储 trace context 到 socket data
 */
export function storeTraceContext(socket: Socket, ctx: Context): void {
  const spanContext = trace.getSpanContext(ctx);
  if (spanContext && trace.isSpanContextValid(spanContext)) {
    socket.data.traceContext = {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
      traceState: spanContext.traceState?.serialize(),
    };
  }
}

/**
 * 从 socket data 恢复 trace context
 */
export function restoreTraceContext(socket: Socket): Context | undefined {
  const stored = socket.data.traceContext;
  if (!stored) {
    return undefined;
  }

  // 创建一个有效的 span context 并设置为 active
  const spanContext: Parameters<typeof trace.setSpanContext>[1] = {
    traceId: stored.traceId,
    spanId: stored.spanId,
    traceFlags: stored.traceFlags,
    isRemote: true,
  };

  if (stored.traceState) {
    // traceState 需要重新解析，简单起见省略
  }

  return trace.setSpanContext(context.active(), spanContext);
}

/**
 * 为 WebSocket 事件创建 child span
 * 用法：在事件处理器中包裹
 */
export function withSocketSpan<T>(
  socket: Socket,
  eventName: string,
  operation: (span: Span) => T | Promise<T>
): Promise<T> | T {
  const tracer = trace.getTracer(TRACER_NAME);
  const parentCtx = restoreTraceContext(socket) || context.active();

  const span = tracer.startSpan(
    AI_SPAN_NAMES.API_WEBSOCKET_EVENT,
    {
      attributes: {
        'websocket.event_type': eventName,
        'websocket.connection_id': socket.id,
        'websocket.room': socket.data.userId || 'anonymous',
        'client.ip': socket.handshake.address,
      },
    },
    parentCtx
  );

  const ctx = trace.setSpan(parentCtx, span);

  const execute = async () => {
    try {
      const result = await context.with(ctx, () => operation(span));
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  };

  return execute();
}

/**
 * 向 WebSocket payload 中注入 trace context
 * 用于 API → Agent Runtime 的消息传播
 */
export function injectTraceContext<T extends Record<string, unknown>>(payload: T): T {
  return injectTraceContextIntoPayload(payload);
}

/**
 * 从 WebSocket payload 中提取 trace context
 * 用于 Agent Runtime → API 的消息恢复
 */
export function extractTraceContext<T extends Record<string, unknown>>(payload: T): Context | undefined {
  return extractTraceContextFromPayload(payload);
}

/**
 * 获取当前 trace_id（用于日志关联）
 */
export { getCurrentTraceId };
