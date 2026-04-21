/**
 * OpenTelemetry SDK 初始化（Agent Runtime）
 * 
 * 由 index.ts 中的 initialize() 调用，而非自动 import。
 * 这样可以根据配置决定是否启用遥测。
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader, Counter, Histogram, ObservableGauge } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { metrics, type Meter } from '@opentelemetry/api';
import { AI_METRICS } from '@agenthive/observability';

let sdk: NodeSDK | null = null;
let meter: Meter | null = null;

export interface TelemetryConfig {
  enabled?: boolean;
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  exportIntervalMs?: number;
}

export function initializeTelemetry(config: TelemetryConfig = {}): NodeSDK | null {
  if (sdk) {
    return sdk;
  }

  const enabled = config.enabled ?? process.env.OTEL_SDK_DISABLED !== 'true';
  if (!enabled) {
    console.log('[Telemetry] OTel SDK disabled by configuration');
    return null;
  }

  const serviceName = config.serviceName || process.env.OTEL_SERVICE_NAME || 'agenthive-agent-runtime';
  const serviceVersion = config.serviceVersion || process.env.npm_package_version || '2.1.0';
  const environment = process.env.NODE_ENV || 'development';
  const otlpEndpoint = config.otlpEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
  const exportIntervalMs = config.exportIntervalMs || 60000;

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    'host.name': process.env.HOSTNAME || 'localhost',
    'agent.runtime.version': serviceVersion,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: otlpEndpoint,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: otlpEndpoint,
      }),
      exportIntervalMillis: exportIntervalMs,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-ws': { enabled: true },
        // Agent Runtime 需要 net 来追踪 WebSocket 连接
        '@opentelemetry/instrumentation-net': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log(`[Telemetry] OpenTelemetry SDK started for ${serviceName} → ${otlpEndpoint}`);

  // 初始化 AgentHive 自定义 metrics
  meter = metrics.getMeter(serviceName, serviceVersion);
  initializeAiMetrics(meter);

  // 优雅关闭
  const shutdown = () => {
    sdk
      ?.shutdown()
      .then(() => console.log('[Telemetry] OTel SDK shut down gracefully'))
      .catch((err) => console.error('[Telemetry] OTel SDK shutdown error:', err))
      .finally(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

/**
 * 注册 AgentHive AI 自定义指标
 */
function initializeAiMetrics(m: Meter): void {
  // LLM 请求计数器
  const llmRequestsCounter = m.createCounter(AI_METRICS.LLM_REQUESTS_TOTAL, {
    description: 'Total LLM API requests',
  });

  // LLM Token 使用直方图
  const llmTokensHistogram = m.createHistogram(AI_METRICS.LLM_TOKENS_TOTAL, {
    description: 'Total tokens used per request',
    unit: '1',
  });

  // LLM 延迟直方图
  const llmLatencyHistogram = m.createHistogram(AI_METRICS.LLM_LATENCY, {
    description: 'LLM API latency',
    unit: 'ms',
  });

  // LLM 成本计数器
  const llmCostCounter = m.createCounter(AI_METRICS.LLM_COST_TOTAL, {
    description: 'Total LLM cost in USD',
    unit: 'USD',
  });

  // LLM 错误计数器
  const llmErrorsCounter = m.createCounter(AI_METRICS.LLM_ERRORS_TOTAL, {
    description: 'Total LLM API errors',
  });

  // Agent 任务计数器
  const agentTasksCounter = m.createCounter(AI_METRICS.AGENT_TASKS_TOTAL, {
    description: 'Total agent tasks',
  });

  // Agent 任务延迟
  const agentTaskDuration = m.createHistogram(AI_METRICS.AGENT_TASK_DURATION, {
    description: 'Agent task duration',
    unit: 'ms',
  });

  // Tool 执行计数器
  const toolExecutionsCounter = m.createCounter(AI_METRICS.TOOL_EXECUTIONS_TOTAL, {
    description: 'Total tool executions',
  });

  // Tool 执行延迟
  const toolExecutionDuration = m.createHistogram(AI_METRICS.TOOL_EXECUTION_DURATION, {
    description: 'Tool execution duration',
    unit: 'ms',
  });

  // Query Loop 迭代计数器
  const queryLoopIterationsCounter = m.createCounter(AI_METRICS.QUERY_LOOP_ITERATIONS_TOTAL, {
    description: 'Total Query Loop iterations',
  });

  // WebSocket 消息计数器
  const wsMessagesCounter = m.createCounter(AI_METRICS.WS_MESSAGES_TOTAL, {
    description: 'Total WebSocket messages',
  });

  // WebSocket 重连计数器
  const wsReconnectsCounter = m.createCounter(AI_METRICS.WS_RECONNECTS_TOTAL, {
    description: 'Total WebSocket reconnects',
  });
}

/**
 * 获取 Meter（用于自定义指标记录）
 */
export function getMeter(): Meter | null {
  return meter;
}

/**
 * 获取 SDK 实例
 */
export function getSdk(): NodeSDK | null {
  return sdk;
}
