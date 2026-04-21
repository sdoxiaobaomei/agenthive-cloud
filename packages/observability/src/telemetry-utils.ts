/**
 * Telemetry Utilities
 * 
 * 提供跨服务的 Trace Context 传播工具，尤其用于 WebSocket、子进程等
 * 标准 HTTP header 无法直接使用的场景。
 */

import { type SpanContext, trace, context, propagation, type Context } from '@opentelemetry/api';

const TRACE_PARENT_KEY = 'traceparent';
const TRACE_STATE_KEY = 'tracestate';

export interface SerializedTraceContext {
  traceparent: string;
  tracestate?: string;
}

/**
 * 将当前活跃的 SpanContext 序列化为可传输的对象
 * 用于 WebSocket payload、Redis message、子进程 env 等场景
 */
export function serializeTraceContext(ctx?: Context): SerializedTraceContext | undefined {
  const activeCtx = ctx ?? context.active();
  const spanContext = trace.getSpanContext(activeCtx);

  if (!spanContext || !trace.isSpanContextValid(spanContext)) {
    return undefined;
  }

  // 使用 W3C 格式序列化
  const carrier: Record<string, string> = {};
  propagation.inject(activeCtx, carrier);

  const result: SerializedTraceContext = {
    traceparent: carrier[TRACE_PARENT_KEY],
  };

  if (carrier[TRACE_STATE_KEY]) {
    result.tracestate = carrier[TRACE_STATE_KEY];
  }

  return result;
}

/**
 * 从序列化的 trace context 恢复为 OTel Context
 * 用于接收 WebSocket message、子进程启动时恢复 parent span
 */
export function deserializeTraceContext(
  serialized: SerializedTraceContext | string | undefined
): Context | undefined {
  if (!serialized) {
    return undefined;
  }

  let carrier: Record<string, string>;

  if (typeof serialized === 'string') {
    carrier = { [TRACE_PARENT_KEY]: serialized };
  } else {
    carrier = { [TRACE_PARENT_KEY]: serialized.traceparent };
    if (serialized.tracestate) {
      carrier[TRACE_STATE_KEY] = serialized.tracestate;
    }
  }

  return propagation.extract(context.active(), carrier);
}

/**
 * 从 WebSocket message payload 中提取 trace context
 * 约定：payload 中如果包含 `_traceContext` 字段，则视为 trace context
 */
export function extractTraceContextFromPayload<T extends Record<string, unknown>>(
  payload: T
): Context | undefined {
  const traceContext = payload['_traceContext'] as SerializedTraceContext | string | undefined;
  if (!traceContext) {
    return undefined;
  }
  return deserializeTraceContext(traceContext);
}

/**
 * 向 payload 中注入 trace context
 * 返回一个新的 payload（不修改原对象）
 */
export function injectTraceContextIntoPayload<T extends Record<string, unknown>>(
  payload: T,
  ctx?: Context
): T & { _traceContext: SerializedTraceContext } {
  const serialized = serializeTraceContext(ctx);
  if (!serialized) {
    return payload as T & { _traceContext: SerializedTraceContext };
  }
  return {
    ...payload,
    _traceContext: serialized,
  };
}

/**
 * 获取环境变量形式的 TRACEPARENT（用于子进程传递）
 */
export function getTraceParentEnv(): Record<string, string> | undefined {
  const serialized = serializeTraceContext();
  if (!serialized) {
    return undefined;
  }
  const env: Record<string, string> = {
    TRACEPARENT: serialized.traceparent,
  };
  if (serialized.tracestate) {
    env.TRACESTATE = serialized.tracestate;
  }
  return env;
}

/**
 * 从环境变量恢复 trace context（子进程启动时调用）
 */
export function contextFromEnv(): Context | undefined {
  const traceparent = process.env.TRACEPARENT;
  if (!traceparent) {
    return undefined;
  }
  return deserializeTraceContext({
    traceparent,
    tracestate: process.env.TRACESTATE,
  });
}

/**
 * 安全地获取当前 trace_id，用于日志关联
 * 如果没有 active span，返回 undefined
 */
export function getCurrentTraceId(): string | undefined {
  const spanContext = trace.getSpanContext(context.active());
  if (spanContext && trace.isSpanContextValid(spanContext)) {
    return spanContext.traceId;
  }
  return undefined;
}

/**
 * 安全地获取当前 span_id，用于日志关联
 */
export function getCurrentSpanId(): string | undefined {
  const spanContext = trace.getSpanContext(context.active());
  if (spanContext && trace.isSpanContextValid(spanContext)) {
    return spanContext.spanId;
  }
  return undefined;
}
