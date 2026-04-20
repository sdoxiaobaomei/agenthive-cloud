# OpenTelemetry 架构与组件

> 理解 OTel 的数据流和 Collector 内部结构，是正确部署和排障的基础。

---

## 1. 核心概念：三种信号（Signals）

| 信号 | 回答的问题 | 类比 |
|------|-----------|------|
| **Metrics** | 系统/服务现在的状态如何？CPU 多少？QPS 多少？ | 体检报告 |
| **Traces** | 请求从哪里出发，经过了哪些服务，每一步花了多久？ | 快递追踪 |
| **Logs** | 某个时间点具体发生了什么？ | 日记 |

**OpenTelemetry 的目标**：用一套标准 API + SDK + Collector，统一采集这三种信号，告别 Prometheus + Zipkin + Fluentd 各玩各的割裂局面。

---

## 2. 架构全景

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AgentHive 可观测性架构                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│   │  Landing    │    │    Web      │    │    API      │               │
│   │  (Nuxt 3)   │    │  (Vue 3)    │    │ (Express)   │               │
│   │             │    │             │    │             │               │
│   │  Browser    │    │  Browser    │    │  Node.js    │               │
│   │  WebTracer  │    │  WebTracer  │    │  Auto-inst  │               │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘               │
│          │ OTLP/HTTP        │ OTLP/HTTP        │ OTLP/gRPC             │
│          └──────────────────┴──────────────────┘                       │
│                             │                                          │
│                             ▼                                          │
│                  ┌─────────────────────┐                               │
│                  │   OTel Collector    │                               │
│                  │                     │                               │
│                  │  Receivers          │  ← 接收 OTLP / Prometheus     │
│                  │  Processors         │  ← Batch / Filter / Resource  │
│                  │  Exporters          │  ← Jaeger / Prometheus / ELK  │
│                  └──────────┬──────────┘                               │
│                             │                                          │
│          ┌──────────────────┼──────────────────┐                      │
│          ▼                  ▼                  ▼                      │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │
│   │   Jaeger    │   │  Prometheus │   │    ELK      │                │
│   │  (Traces)   │   │  (Metrics)  │   │   (Logs)    │                │
│   └─────────────┘   └─────────────┘   └─────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Collector 内部结构

Collector 由三大核心模块组成：

### 3.1 Receivers（接收器）

负责接收来自应用或外部系统的数据。

| Receiver | 协议 | 适用场景 |
|----------|------|----------|
| `otlp` | gRPC/HTTP | **首选**。应用 SDK 标准上报协议 |
| `prometheus` | Pull | 兼容现有 Prometheus 生态，从 /metrics 端点拉取 |
| `jaeger` | Thrift/gRPC | 兼容旧版 Jaeger Agent 上报 |
| `zipkin` | HTTP JSON | 兼容 Zipkin 格式 |

**AgentHive 推荐**：应用统一走 `otlp`，遗留系统可逐步迁移。

### 3.2 Processors（处理器）

在数据被导出之前，对数据进行转换、过滤、聚合。

| Processor | 作用 | 生产必配？ |
|-----------|------|-----------|
| `batch` | 聚合多个数据包，减少网络请求 | ✅ 必配 |
| `memory_limiter` | 防止内存溢出，保护 Collector | ✅ 高流量必配 |
| `resource` | 注入/修改资源属性（service.name, env 等） | ✅ 推荐 |
| `attributes` | 过滤敏感字段（password, token） | ✅ 安全必配 |
| `tail_sampling` | 智能采样，只保留异常/慢请求的 Trace | ⚠️ 高流量建议 |

### 3.3 Exporters（导出器）

将处理后的数据发送到后端存储或分析系统。

| Exporter | 后端 | 数据类型 |
|----------|------|----------|
| `otlp/jaeger` | Jaeger | Traces |
| `prometheus` | Prometheus | Metrics |
| `prometheusremotewrite` | Prometheus Remote Write | Metrics |
| `otlphttp` | ELK / Tempo / 其他 OTLP 兼容系统 | All |
| `logging` | stdout | All（调试用） |

---

## 4. Pipeline 设计原则

```yaml
service:
  pipelines:
    metrics:
      receivers: [otlp, prometheus]
      processors: [resource, batch]
      exporters: [prometheus]
```

**设计要点**：
1. **信号分离**：Metrics / Traces / Logs 各自独立 Pipeline，避免互相阻塞
2. **Processor 顺序**：Filter → Enrich（Resource）→ Aggregate（Batch）
3. **多 Exporter**：同一份数据可以同时发向 Jaeger（Traces）和 stdout（调试）

---

## 5. 部署模式

### 模式 A：Agent 模式（Sidecar / DaemonSet）

每个节点或每个 Pod 部署一个 Collector Agent，负责：
- 接收本地应用的 OTLP 数据
- 做初步的 Batch / Filter
- 通过 gRPC 转发到 Gateway Collector

**适用**：Kubernetes 环境，降低应用感知度。

### 模式 B：Gateway 模式（集中式）

集群中心部署少量 Gateway Collector，负责：
- 接收来自所有 Agent 的数据
- 做复杂的 Tail Sampling / Attribute Enrichment
- 导出到后端存储

**适用**：多集群、多可用区场景。

### 模式 C：Standalone 模式（独立单实例）

本地开发或单 VM 场景，一个 Collector 搞定所有事情。

**AgentHive 当前采用**：本地开发用 Standalone，生产环境演进为 Agent + Gateway 双层架构。

---

## 6. 数据量估算（生产参考）

| 指标 | 100 RPS 服务 | 1000 RPS 服务 | 10,000 RPS 服务 |
|------|-------------|--------------|----------------|
| Traces（全量采样） | ~5 MB/min | ~50 MB/min | ~500 MB/min |
| Traces（1% 概率采样） | ~50 KB/min | ~500 KB/min | ~5 MB/min |
| Metrics | ~1 MB/min | ~2 MB/min | ~5 MB/min |
| Logs | ~10 MB/min | ~100 MB/min | ~1 GB/min |

**结论**：Traces 是存储大头，生产环境必须配置采样策略。
