/**
 * Nuxt 3 Nitro Server Plugin - OpenTelemetry 初始化
 * 
 * 在 SSR 服务端初始化 OTel，追踪 server API routes 和 Nitro 渲染。
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

const serviceName = process.env.OTEL_SERVICE_NAME || 'agenthive-landing';
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
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

sdk.start();
console.log(`[Telemetry] Landing server OTel SDK started → ${otlpEndpoint}`);

process.on('SIGTERM', () => {
  sdk.shutdown().catch(console.error);
});

export default defineNitroPlugin(() => {
  // Nitro 插件需要至少一个导出
  console.log('[Telemetry] Nitro telemetry plugin loaded');
});
