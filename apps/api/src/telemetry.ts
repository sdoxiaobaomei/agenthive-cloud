/**
 * OpenTelemetry SDK 初始化（API 服务）
 * 
 * ⚠️ 必须在其他所有 import 之前执行！
 * 使用方式：在 index.ts 第一行 `import './telemetry'`
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SemanticResourceAttributes,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import logger from './utils/logger.js';

// 仅在开发环境启用 OTel 内部调试日志
if (process.env.OTEL_LOG_LEVEL === 'debug') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const serviceName = process.env.OTEL_SERVICE_NAME || 'agenthive-api';
const serviceVersion = process.env.npm_package_version || '1.0.0';
const environment = process.env.NODE_ENV || 'development';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';

const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: serviceName,
  [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  'host.name': process.env.HOSTNAME || 'localhost',
});

const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: otlpEndpoint,
    // gRPC 不设置 tls 时默认为 insecure
    ...(otlpEndpoint.startsWith('https') ? {} : {}),
  }),
  // @ts-ignore version mismatch between sdk-node and sdk-metrics
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: otlpEndpoint,
    }),
    exportIntervalMillis: 60000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // 启用：HTTP, Express, Socket.IO, PostgreSQL, Redis, WS
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-socket.io': { enabled: true },
      '@opentelemetry/instrumentation-ioredis': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      // '@opentelemetry/instrumentation-ws': { enabled: true }, // ws instrumentation not available in current version
      // 禁用：文件系统（噪声极大）
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // 网络层由 Beyla 覆盖，减少重复
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

// 启动 SDK
sdk.start();
logger.info('[Telemetry] OpenTelemetry SDK started', { serviceName, otlpEndpoint });

// 优雅关闭
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => logger.info('[Telemetry] OTel SDK shut down gracefully'))
    .catch((err) => logger.error('[Telemetry] OTel SDK shutdown error', err))
    .finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  sdk
    .shutdown()
    .then(() => logger.info('[Telemetry] OTel SDK shut down gracefully'))
    .catch((err) => logger.error('[Telemetry] OTel SDK shutdown error', err))
    .finally(() => process.exit(0));
});

export default sdk;
