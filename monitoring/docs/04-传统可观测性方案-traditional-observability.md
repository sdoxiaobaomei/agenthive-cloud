# 传统可观测性方案（无 OpenTelemetry）

> 在 OpenTelemetry 出现之前，企业如何整合 Metrics、Logs、Traces？Prometheus + Grafana + ELK 够不够用？还需要什么？
>
> 本文是 [OpenTelemetry 知识库](../opentelemetry/docs/) 的对照参考。

---

## 核心结论（ upfront ）

| 问题 | 答案 |
|------|------|
| Prometheus + Grafana + ELK 能做三支柱吗？ | **能做 Metrics + Logs**，但 Traces 需要额外加一套系统（Jaeger/Zipkin/SkyWalking） |
| 三种信号能关联吗？ | **能，但很割裂**。需要在代码里手动打 `trace_id`，在三个 UI 之间切换 |
| 和 OTel 比差距在哪？ | 传统方案 = N 个 Agent + N 套 SDK + 手动关联。OTel = 1 个 Collector + 1 套 SDK + 自动关联 |
| 小公司够用吗？ | **够用**。很多公司跑了好几年 Prometheus + ELK + Jaeger，业务没受影响 |

---

## 1. 传统企业的典型技术栈

```
┌─────────────────────────────────────────────────────────────────────┐
│                          应用层                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │ 服务 A   │  │ 服务 B   │  │ 服务 C   │                          │
│  │ (Go)     │  │ (Java)   │  │ (Node)   │                          │
│  │          │  │          │  │          │                          │
│  │ Prom SDK │  │ Micrometr│  │ prom-clt │  ← Metrics（各自语言）   │
│  │ Logrus   │  │ SLF4J    │  │ Winston  │  ← Logs（各自语言）      │
│  │ JaegerGo │  │ Brave    │  │ JaegerN  │  ← Traces（各自语言）    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                          │
└───────┼─────────────┼─────────────┼──────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          采集层                                      │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ Prometheus Server      │  │ Fluentd/Logstash       │             │
│  │ (Pull /metrics)        │  │ (Push 日志)             │             │
│  └────────────────────────┘  └────────────────────────┘             │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ Jaeger/Zipkin Agent    │  │ Node Exporter          │             │
│  │ (Push Traces)          │  │ (系统指标)              │             │
│  └────────────────────────┘  └────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          存储层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐         │
│  │ Prometheus  │  │Elasticsearch│  │   Jaeger Backend    │         │
│  │  (TSDB)     │  │   (Logs)    │  │   (Cassandra/ES)    │         │
│  └─────────────┘  └─────────────┘  └─────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          展示层                                      │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ Grafana                │  │ Kibana                 │             │
│  │ → Prometheus 数据源    │  │ → Elasticsearch 数据源 │             │
│  │ → Jaeger 数据源        │  │                        │             │
│  └────────────────────────┘  └────────────────────────┘             │
│  ┌────────────────────────┐                                        │
│  │ Jaeger UI / Zipkin UI  │                                        │
│  └────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**关键特征**：Metrics、Logs、Traces 各自有独立的采集 → 存储 → 展示链路，三套系统并行运行。

---

## 2. 三种信号如何关联？（无 OTel 的痛点）

### 2.1 Metrics ↔ Logs 关联

**方式：相同标签（Label）**

Prometheus 采集的指标带有标签：
```promql
http_requests_total{service="agenthive-api", instance="10.0.1.5:8080"}
```

应用在日志中也打印相同的字段：
```json
{
  "service": "agenthive-api",
  "instance": "10.0.1.5:8080",
  "message": "Request processed",
  "duration_ms": 120
}
```

**Grafana 中的操作**：
1. 在 Metrics 图表上看到某个服务 QPS 飙升
2. 记住时间戳和服务名
3. 切换到 Logs 面板（Elasticsearch 或 Loki 数据源），用相同标签过滤
4. 查看该时间段的日志详情

**痛点**：需要在两个数据源之间手动切换，时间戳要对齐。

---

### 2.2 Logs ↔ Traces 关联

**方式：日志中打印 `trace_id` 和 `span_id`**

需要在应用代码中手动注入：
```go
// Go 示例
logger.Info("processing request",
    zap.String("trace_id", span.SpanContext().TraceID().String()),
    zap.String("span_id", span.SpanContext().SpanID().String()),
)
```

日志输出：
```json
{
  "trace_id": "a1b2c3d4e5f6...",
  "span_id": "g7h8i9j0k1l2...",
  "message": "processing request"
}
```

**使用场景**：
1. 在 Kibana 中看到一条 ERROR 日志，复制 `trace_id`
2. 打开 Jaeger UI，搜索该 `trace_id`
3. 看到完整的调用链路

**痛点**：
- 每个语言/框架的日志库注入方式不同
- 没有统一标准，容易遗漏
- 需要在 Kibana 和 Jaeger 两个 UI 之间复制粘贴

---

### 2.3 Metrics ↔ Traces 关联

**方式：间接关联（最弱的一环）**

通常的做法：
1. 在 Grafana 上看到某个 API 的 P99 延迟飙升
2. 在 Prometheus 中配置告警规则，触发时附带上下文信息
3. 手动去 Jaeger 中按服务名 + 时间范围搜索 Trace
4. 找到慢请求，查看详细 Span

**更高级的做法（需要 APM 工具）**：
- 使用 SkyWalking / Pinpoint，它们天然把 Metrics 和 Traces 放在同一个 Agent 里采集
- 或者在 Jaeger 中启用 SPM（Service Performance Monitoring），从 Trace 中聚合出 Metrics

**痛点**：这是三者关联中最难、最手动的一环。没有统一标准，纯靠人肉和告警。

---

## 3. 典型的三种企业方案

### 方案 A：全开源 Grafana 生态（推荐新上项目）

| 信号 | 工具 | 说明 |
|------|------|------|
| Metrics | **Prometheus** | 标准时序数据库 |
| Logs | **Loki** | Grafana 家的日志系统，标签模型和 Prometheus 一致 |
| Traces | **Tempo** | Grafana 家的 Trace 系统，轻量级 |
| 展示 | **Grafana** | 统一界面，三种信号在同一 dashboard |
| 采集 | **Promtail** + **Grafana Agent** | 统一采集日志和 traces |

**优势**：
- 三种信号统一在 Grafana 中查看，用户体验最好
- Loki 的标签模型和 Prometheus 完全一致，关联查询简单
- Tempo 只存储 TraceID，成本极低

**劣势**：
- Tempo 相比 Jaeger 功能较新，社区生态小一些
- Loki 的日志搜索能力不如 Elasticsearch（不能做复杂聚合）

**适用**：中小团队，希望统一界面，日志量不大（日 GB 级别）。

---

### 方案 B：混合开源（最经典）

| 信号 | 工具 | 说明 |
|------|------|------|
| Metrics | **Prometheus** | |
| Logs | **ELK**（Elasticsearch + Logstash + Kibana） | 日志搜索之王 |
| Traces | **Jaeger** | CNCF 毕业项目，最成熟 |
| 展示 | **Grafana**（Metrics + Traces）+ **Kibana**（Logs） | 双 UI |

**优势**：
- 每个组件都是各自领域的王者，文档丰富，社区活跃
- Elasticsearch 的日志搜索和聚合能力最强
- Jaeger 的 Trace 分析功能完善

**劣势**：
- 三个独立系统，维护成本高
- 需要在 Grafana 和 Kibana 之间切换
- 日志和指标的存储成本较高（ES 很吃资源）

**适用**：中大团队，日志量大（日 TB 级别），对日志搜索要求高。

---

### 方案 C：商业方案（不差钱）

| 工具 | 说明 | 价格 |
|------|------|------|
| **Datadog** | 三支柱一体化，APM 极强 | $70/月/主机起 |
| **New Relic** | 全栈可观测性，用户体验好 | 按数据量计费 |
| **Dynatrace** | AI 驱动的根因分析 | 贵，按主机计费 |
| **Splunk Observability** | 日志之王 Splunk 的可观测性套件 | 非常贵 |
| **阿里云 ARMS** | 国内友好，ACK 深度集成 | 按量计费 |

**优势**：
- 三支柱天然集成，一键关联
- 开箱即用，无需自运维
- APM 功能强大（自动发现拓扑、AI 根因分析）

**劣势**：
- 贵
- 数据锁定（导出困难）
- 定制化受限

**适用**：
- 有预算的中大厂
- 团队没有专职 SRE 维护自研可观测性平台
- 需要快速获得价值

---

## 4. 还需要哪些工具？

在 Prometheus + Grafana + ELK 的基础上，为了弥补三支柱的割裂，通常还需要：

### 4.1 统一采集代理

| 工具 | 作用 | 替代方案 |
|------|------|---------|
| **Fluentd / Fluent Bit** | 统一采集日志，可输出到 ES / Loki / S3 等多个后端 | Logstash（重）、Vector（新） |
| **Grafana Agent** | 统一采集 Metrics + Logs + Traces + Profiles | Prometheus Agent + Promtail + OTel Collector |

### 4.2 Trace 采集（必加）

| 工具 | 特点 | 适用场景 |
|------|------|---------|
| **Jaeger** | CNCF 毕业，功能最全 | 通用，社区最大 |
| **Zipkin** | Twitter 开源，轻量 | 简单场景， legacy 系统 |
| **SkyWalking** | Apache 基金会，对 Java 极友好 | Java 技术栈为主 |
| **Pinpoint** | 韩国开源，UI 极详细 | Java，需要深入分析 |
| **Tempo** | Grafana 生态，低成本 | Grafana 用户 |

### 4.3 上下文自动注入（减少代码改动）

| 工具 | 作用 |
|------|------|
| **Istio / Linkerd**（Service Mesh） | 自动在 HTTP/gRPC 请求中注入 `traceparent` header，应用**零改动**即可获得 Trace |
| **Envoy** | 作为 sidecar，自动采集 Metrics 和 Traces |

**关键洞察**：Service Mesh 是**无 OTel 场景下**获得分布式追踪的最优雅方式——应用完全不需要改代码，Sidecar 自动处理所有上下文传播。

### 4.4 告警与通知

| 工具 | 作用 |
|------|------|
| **Alertmanager** | Prometheus 的告警路由、分组、静默、抑制 |
| **PagerDuty / OpsGenie** | 告警升级、on-call 排班 |
| **企业微信 / 钉钉 / Slack** | 告警通知渠道 |

### 4.5 成本优化（日志量大了以后必做）

| 工具 | 作用 |
|------|------|
| **Cortex / Thanos** | Prometheus 的长期存储和全局查询视图 |
| **S3 / OSS + Lifecycle** | 冷日志归档（降低 ES 存储成本） |
| **VictoriaMetrics** | Prometheus 的高性能替代，存储成本降低 7x |

---

## 5. 无 OTel vs 有 OTel 的核心差异

| 维度 | 无 OTel（传统方案） | 有 OTel |
|------|-------------------|---------|
| **SDK** | 各用各的（Prom client, Logrus, Jaeger client） | 一套 OTel SDK，统一 API |
| **Agent** | N 个（Prom exporter, Fluentd, Jaeger agent） | 1 个 OTel Collector |
| **上下文传播** | 手动在代码中传递 `trace_id` | 自动 W3C Trace Context |
| **三种信号关联** | 手动（日志里打 trace_id，标签对齐） | 自动（Collector 统一关联） |
| **Vendor 锁定** | 高（深度绑定 Prometheus/ELK/Jaeger） | 低（标准格式，后端可换） |
| **学习成本** | 低（各组件独立学习） | 中（需要理解 Collector 架构） |
| **运维成本** | 高（N 套系统分别维护） | 低（统一 Collector 配置） |
| **社区生态** | 成熟（各组件都 5-10 年历史） | 快速增长（CNCF 重点扶持） |

---

## 6. AgentHive 的推荐路径

结合你现有的 Prometheus + Grafana + ELK 栈：

### 短期（现在）
保持现有栈，**补充 Jaeger** 做 Traces：
```
Metrics:  Prometheus + Grafana ✅ 已有
Logs:     ELK ✅ 已有
Traces:   + Jaeger（新上）
```
在应用中手动注入 `trace_id` 到日志，实现 Logs ↔ Traces 关联。

### 中期（日志量上来后）
考虑用 **Loki 替代 Elasticsearch**，降低日志存储成本：
```
Metrics:  Prometheus + Grafana ✅
Logs:     Loki（替换 ELK）
Traces:   Jaeger / Tempo
```
Loki 和 Prometheus 标签模型一致，Grafana 中关联查询体验更好。

### 长期（团队规模扩大）
平滑迁移到 **OpenTelemetry**：
```
应用 SDK: OTel SDK（统一替换 Prom client + Logrus + Jaeger client）
采集:     OTel Collector（统一替换 N 个 Agent）
后端:     Prometheus + Loki + Jaeger/Tempo（不变）
```
后端存储不需要换，只需要换采集层——这就是 OTel 的"后端无关"优势。

---

## 7. 一句话总结

> **不用 OTel，Prometheus + ELK + Jaeger 完全能跑，但你需要维护三套独立的采集/存储/展示系统，且三种信号的关联需要手动在代码里打补丁。OTel 的价值不是"让你能做三支柱"，而是"让你用一套标准、一个 Agent、自动关联地去做三支柱"。**
