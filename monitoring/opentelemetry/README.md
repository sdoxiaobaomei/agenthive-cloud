# AgentHive OpenTelemetry 可观测性知识库

> OpenTelemetry（OTel）是云原生计算基金会（CNCF）孵化的可观测性框架，提供**Metrics（指标）、Traces（链路）、Logs（日志）**的统一采集标准。
>
> 本知识库聚焦 OTel Collector 的部署配置与 AgentHive 各服务的接入实践。

---

## 目录结构

```
opentelemetry/
├── README.md                          # 本文件：总览与快速开始
├── docker-compose.yml                 # 本地开发一键启动（Collector + Jaeger + Prometheus）
├── otel-collector/
│   ├── Dockerfile                     # Collector 镜像构建
│   └── otel-collector.yml             # Collector 核心配置
├── docs/
│   ├── 01-架构与组件-architecture.md   # 架构设计、数据流、组件职责
│   ├── 02-应用接入-instrumentation.md  # 各语言 SDK 接入指南
│   └── 03-集成现有栈-integration.md    # 与 Prometheus/Grafana/ELK 集成
└── k8s/
    └── otel-collector.yaml            # Kubernetes Deployment + Service
```

---

## 为什么需要 OpenTelemetry

AgentHive 现有的监控栈（Prometheus + Grafana）专注于 **Metrics**，但缺少：

| 能力 | 现有栈 | OpenTelemetry 补充 |
|------|--------|-------------------|
| **Metrics** | ✅ Prometheus | ✅ Collector 兼容 Prometheus 导出 |
| **Traces** | ❌ 无 | ✅ 分布式链路追踪（Jaeger/Tempo） |
| **Logs** | ⚠️ ELK（独立） | ✅ 统一采集，与 Traces 关联 |
| **上下文关联** | ❌ Metrics/Logs/Traces 割裂 | ✅ TraceID 串联全链路 |

**核心优势**：一个 Collector 统一接收三种信号，消除 N 个 Agent 的维护成本。

---

## 🚀 快速开始

### 方式一：本地开发测试（docker-compose）

```bash
cd monitoring/opentelemetry
docker-compose up -d
```

访问地址：
- Jaeger UI: http://localhost:16686（查看 Traces）
- Prometheus: http://localhost:9090（查看 OTel 导出的 Metrics）
- Collector 暴露端口：
  - `4317` gRPC OTLP
  - `4318` HTTP OTLP
  - `8889` Prometheus 指标导出

### 方式二：接入现有 monitoring 栈

如果你已经在跑 `monitoring/docker-compose.yml`（Prometheus + Grafana），只需启动 Collector：

```bash
cd monitoring/opentelemetry
docker-compose up -d otel-collector
```

然后在 `monitoring/prometheus/prometheus.yml` 中添加：

```yaml
scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8889']
```

---

## 📦 组件清单

| 组件 | 版本 | 职责 | 端口 |
|------|------|------|------|
| **OTel Collector** | 0.96.0 | 统一接收/处理/导出三种信号 | 4317/4318/8889 |
| **Jaeger** | 1.53.0 | Traces 存储与查询 | 16686/14250 |
| **Prometheus** | 2.48.0 | Metrics 存储（复用现有栈或独立） | 9090 |

---

## 🔗 与 AgentHive 服务集成

| 服务 | 语言/框架 | 接入方式 | 文档 |
|------|----------|----------|------|
| **Landing** | Nuxt 3 (Node.js) | `@opentelemetry/auto-instrumentations-node` | [docs/02-应用接入-instrumentation.md](./docs/02-应用接入-instrumentation.md#nodejs) |
| **Web** | Vue 3 + Vite (Node.js) | 浏览器端 WebTracer + 服务端 Node SDK | [docs/02-应用接入-instrumentation.md](./docs/02-应用接入-instrumentation.md#前端-browser) |
| **API** | Express (Node.js) | `@opentelemetry/sdk-node` | [docs/02-应用接入-instrumentation.md](./docs/02-应用接入-instrumentation.md#nodejs) |
| **Agent Runtime** | Node.js | 同上 | [docs/02-应用接入-instrumentation.md](./docs/02-应用接入-instrumentation.md#nodejs) |

---

## 📖 文档导航

| 文档 | 适合谁 | 内容 |
|------|--------|------|
| [docs/01-架构与组件-architecture.md](./docs/01-架构与组件-architecture.md) | 架构师 / 技术负责人 | Collector 架构、数据流、Receiver/Processor/Exporter 设计 |
| [docs/02-应用接入-instrumentation.md](./docs/02-应用接入-instrumentation.md) | 后端/前端开发者 | 各语言 SDK 接入、自动/手动 Instrumentation、 baggage 传递 |
| [docs/03-集成现有栈-integration.md](./docs/03-集成现有栈-integration.md) | 运维 / SRE | 与 Prometheus、Grafana、ELK 的对接配置、生产级调优 |

---

## 🔒 安全建议

1. **TLS 传输**：生产环境 Collector 启用 OTLP/gRPC TLS（`tls` 配置块）
2. **Token 鉴权**：Collector 前部署 OAuth2 Proxy 或 API Gateway 做鉴权
3. **敏感数据脱敏**：在 Collector Processor 中配置 `attributes` 处理器，过滤 `password`、`token` 等字段
4. **采样率控制**：生产环境建议配置 Tail-based Sampling 或概率采样（`tail_sampling` / `probabilistic_sampler`），避免存储爆炸

---

## 📝 更新日志

### v1.0.0
- 初始版本
- 集成 OTel Collector v0.96.0
- 集成 Jaeger v1.53.0
- 支持 Metrics / Traces / Logs 统一采集
- 提供 Node.js / Browser 接入示例
