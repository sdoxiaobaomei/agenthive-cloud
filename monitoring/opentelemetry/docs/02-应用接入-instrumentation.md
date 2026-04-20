# 应用接入指南（Instrumentation）

> 让 AgentHive 的前端、后端服务接入 OpenTelemetry，采集 Traces 和 Metrics。

---

## 快速决策表

| 服务 | 运行时 | 推荐方式 | 复杂度 |
|------|--------|----------|--------|
| Landing (Nuxt 3) | Node.js + Browser | 服务端 Auto-inst + 浏览器 WebTracer | 中 |
| Web (Vue 3) | Node.js + Browser | 同上 | 中 |
| API (Express) | Node.js | Auto-inst（@opentelemetry/auto-instrumentations-node） | 低 |
| Agent Runtime | Node.js | 同上 | 低 |

---

## 1. Node.js 后端接入（API / Agent Runtime）

### 1.1 安装依赖

```bash
cd apps/apps/api
npm install --save \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/exporter-metrics-otlp-grpc \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

### 1.2 创建初始化文件 `src/telemetry.ts`

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'agenthive-api',
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    }),
    exportIntervalMillis: 60000,
  }),
  instrumentations: [getNodeAutoInstrumentations({
    // 只启用需要的 instrumentation，减少开销
    '@opentelemetry/instrumentation-fs': { enabled: false }, // 文件系统噪声大
    '@opentelemetry/instrumentation-net': { enabled: false },
  })],
});

sdk.start();

// 优雅关闭
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OTel SDK shut down'))
    .catch((err) => console.error('OTel SDK shutdown error:', err))
    .finally(() => process.exit(0));
});
```

### 1.3 在应用入口引入

```typescript
// apps/apps/api/src/index.ts
import './telemetry'; // 必须放在最前面！
import express from 'express';
// ...
```

> ⚠️ **关键**：`telemetry.ts` 必须在其他所有 `import` 之前执行，否则 instrumentation 无法劫持模块。

### 1.4 环境变量

```bash
# .env.development
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_INSECURE=true
```

---

## 2. 前端 Browser 接入（Landing / Web）

前端 Trace 主要用于：
- 页面加载性能分析（FCP, LCP, TTFB）
- 用户交互追踪（点击、路由跳转）
- 与后端 Trace 的上下文关联（通过 TraceID）

### 2.1 安装依赖

```bash
cd apps/apps/landing
npm install --save \
  @opentelemetry/sdk-trace-web \
  @opentelemetry/instrumentation-document-load \
  @opentelemetry/instrumentation-fetch \
  @opentelemetry/instrumentation-xml-http-request \
  @opentelemetry/context-zone \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

### 2.2 创建 `plugins/telemetry.client.ts`（Nuxt）

```typescript
// Nuxt 3 Client Plugin
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export default defineNuxtPlugin(() => {
  if (process.server) return; // 只在浏览器端执行

  const provider = new WebTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'agenthive-landing',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'production',
    }),
  });

  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: 'http://localhost:4318/v1/traces', // 注意：浏览器走 HTTP，不是 gRPC
      })
    )
  );

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/\.internal\.api/], // 向后端传播 TraceID
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [/\.internal\.api/],
      }),
    ],
  });
});
```

### 2.3 CORS 配置（关键！）

浏览器端 OTel 需要向后端 API 发送 `traceparent` header，后端必须允许：

```typescript
// API 的 CORS 配置
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  allowedHeaders: ['Content-Type', 'Authorization', 'traceparent', 'tracestate'],
}));
```

---

## 3. 手动创建 Span（业务级追踪）

自动 Instrumentation 只能捕获框架层面的调用（HTTP 请求、DB 查询）。业务逻辑需要手动埋点：

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('agenthive-business', '1.0.0');

async function processTicket(ticketId: string) {
  // 创建 Span
  const span = tracer.startSpan('process-ticket', {
    attributes: { 'ticket.id': ticketId },
  });

  try {
    span.addEvent('validation-start');
    await validateTicket(ticketId);
    span.addEvent('validation-end');

    span.addEvent('processing-start');
    const result = await doProcessing(ticketId);
    span.addEvent('processing-end', { 'result.status': result.status });

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

在 Jaeger UI 中可以看到：
```
process-ticket
├── [event] validation-start
├── [event] validation-end
├── [event] processing-start
├── [event] processing-end {result.status: success}
└── [status] OK
```

---

## 4. 上下文传播（跨服务 TraceID 串联）

OTel 的 `traceparent` header 格式（W3C 标准）：
```
traceparent: 00-<trace-id>-<span-id>-<flags>
```

**前端 → API → 下游服务** 的自动传播：
1. 前端 Fetch/XHR 自动注入 `traceparent`
2. API 的 Express Instrumentation 自动解析 `traceparent`
3. API 调用下游服务时，HTTP Client Instrumentation 自动携带 `traceparent`

**在代码中获取当前 TraceID**（用于日志关联）：
```typescript
import { trace } from '@opentelemetry/api';

const span = trace.getActiveSpan();
if (span) {
  const traceId = span.spanContext().traceId;
  logger.info('Processing request', { traceId });
}
```

---

## 5. 接入检查清单

| 检查项 | 后端（API） | 前端（Landing/Web） |
|--------|-----------|-------------------|
| `telemetry.ts` 在入口第一行引入 | ⬜ | N/A |
| `OTEL_EXPORTER_OTLP_ENDPOINT` 环境变量配置 | ⬜ | ⬜（硬编码或运行时注入） |
| CORS 允许 `traceparent` header | ⬜ | N/A |
| 过滤敏感属性（password/token） | ⬜ | ⬜ |
| 服务端 `fs` / `net` instrumentation 关闭 | ⬜ | N/A |
| 优雅关闭处理（SIGTERM） | ⬜ | N/A |
