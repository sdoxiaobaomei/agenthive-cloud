/**
 * @agenthive/observability
 * 
 * AgentHive Cloud 共享可观测性库
 * 提供 AI 语义约定、Trace Context 传播工具
 */

export {
  AI_ATTRIBUTES,
  AI_SPAN_NAMES,
  AI_METRICS,
  type AiAttributeKey,
  type AiSpanName,
} from './ai-attributes.js';

export {
  serializeTraceContext,
  deserializeTraceContext,
  extractTraceContextFromPayload,
  injectTraceContextIntoPayload,
  getTraceParentEnv,
  contextFromEnv,
  getCurrentTraceId,
  getCurrentSpanId,
  type SerializedTraceContext,
} from './telemetry-utils.js';
