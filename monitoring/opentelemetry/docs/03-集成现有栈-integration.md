# 集成现有监控栈

> AgentHive 已有 Prometheus + Grafana + ELK，OpenTelemetry 不是替换，而是**增强和统一**。

---

## 1. 与 Prometheus + Grafana 集成

### 1.1 架构关系

```
┌─────────────────────────────────────────────────────────┐
│                    集成架构                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  应用 SDK ──OTLP──► OTel Collector                      │
│                         │                               │
│                         ├──► Prometheus Exporter (8889) │
│                         │       │                       │
│                         │       ▼                       │
│                         │   ┌─────────────┐             │
│                         │   │  Prometheus │             │
│                         │   │  (现有栈)   │             │
│                         │   └──────┬──────┘             │
│                         │          │                    │
│                         │          ▼                    │
│                         │   ┌─────────────┐             │
│                         └──►│   Grafana   │             │
│                             │  (现有栈)   │             │
│                             └─────────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 配置步骤

**Step 1：修改现有 Prometheus 配置**

编辑 `monitoring/prometheus/prometheus.yml`，添加 Collector 的 scrape 任务：

```yaml
scrape_configs:
  # 原有配置保留...
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # 新增：采集 OTel Collector 导出的指标
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8889']
    metrics_path: /metrics
```

**Step 2：启动 Collector**

```bash
cd monitoring
docker-compose up -d otel-collector  # 如果 Collector 定义在 monitoring 的 compose 中
# 或
cd monitoring/opentelemetry
docker-compose up -d otel-collector
```

**Step 3：验证 Grafana 数据源**

Grafana 的 Prometheus 数据源已经配置好了，OTel 导出的指标会直接出现在 Prometheus 中。查询示例：

```promql
# 查看 HTTP 请求速率（由 Auto-Instrumentation 自动生成）
rate(http_server_duration_count[5m])

# 查看各服务的 Span 数量
rate(otelcol_receiver_accepted_spans[5m])
```

### 1.3 指标命名规范

OTel 的指标名称和 Prometheus 原生指标有差异：

| OTel 指标名 | Prometheus 导出后 | 说明 |
|------------|------------------|------|
| `http.server.duration` | `http_server_duration_*` | 下划线替换点 |
| `process.runtime.memory` | `process_runtime_memory_*` | 自动转换 |

Grafana 查询时直接使用下划线格式即可。

---

## 2. 与 ELK 集成（Logs）

### 2.1 架构关系

```
应用 SDK ──OTLP Logs──► OTel Collector
                              │
                              ▼
                        ┌─────────────┐
                        │  Logstash   │  ← 接收 OTLP/HTTP
                        │  (或 Filebeat)│
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │ Elasticsearch│
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Kibana    │
                        └─────────────┘
```

### 2.2 Collector 配置（导出 Logs 到 ELK）

在 `otel-collector.yml` 中取消注释 Logs Exporter：

```yaml
exporters:
  otlphttp/elk:
    endpoint: http://logstash:5044/otel
    tls:
      insecure: true

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [resource, attributes/filter, batch]
      exporters: [otlphttp/elk, logging]
```

### 2.3 Logstash 配置

在 `monitoring/elk/logstash.conf` 中添加 OTLP 输入：

```conf
input {
  http {
    port => 5044
    codec => json
    additional_codecs => { "application/json" => "json" }
  }
}

filter {
  # 解析 OTel 日志结构
  if [body] {
    mutate {
      rename => { "[body][stringValue]" => "message" }
    }
  }

  # 提取 TraceID 用于关联
  if [traceId] {
    mutate {
      add_field => { "trace_id" => "%{traceId}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "otel-logs-%{+YYYY.MM.dd}"
  }
}
```

### 2.4 Kibana 日志关联 Trace

在 Kibana Discover 中创建查询：
```
trace_id: "a1b2c3d4e5f6..."
```

可同时看到：
- 该 Trace 涉及的所有服务日志
- 对应的 Metrics（在 Grafana）
- 对应的 Trace 详情（在 Jaeger）

---

## 3. Kubernetes 部署

### 3.1 单层部署（Standalone）

适用于：单集群、流量不大的场景。

```bash
kubectl apply -f monitoring/opentelemetry/k8s/otel-collector.yaml
```

### 3.2 双层部署（Agent + Gateway）

适用于：多可用区、高流量、需要复杂采样的生产环境。

**Agent（DaemonSet，每个节点一个）**：
```yaml
# agent-daemonset.yaml（节选）
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: otel-agent
spec:
  template:
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.96.0
          args: ["--config", "/conf/agent.yaml"]
          volumeMounts:
            - name: cfg
              mountPath: /conf
```

Agent 配置只做轻量处理（Batch + Resource），然后转发到 Gateway。

**Gateway（Deployment + Service，集群级）**：
```yaml
# gateway-deployment.yaml（节选）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-gateway
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.96.0
          args: ["--config", "/conf/gateway.yaml"]
```

Gateway 配置做复杂处理（Tail Sampling + Attribute Enrichment），然后导出到 Jaeger/Prometheus/ELK。

---

## 4. 生产级调优

### 4.1 Collector 资源限制

| 场景 | CPU Request | CPU Limit | Memory Request | Memory Limit |
|------|------------|-----------|----------------|--------------|
| 开发测试 | 100m | 500m | 128Mi | 512Mi |
| 中小生产（<1000 RPS） | 500m | 2 | 512Mi | 2Gi |
| 大生产（>10000 RPS） | 2 | 8 | 2Gi | 8Gi |

### 4.2 采样策略

**概率采样（Probabilistic）**：
```yaml
processors:
  probabilistic_sampler:
    sampling_percentage: 10.0  # 只保留 10% 的 Trace
```

**尾部采样（Tail Sampling）**：只保留异常或慢请求
```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100
    expected_new_traces_per_sec: 10
    policies:
      - name: errors
        type: status_code
        status_code: {status_codes: [ERROR]}
      - name: slow_requests
        type: latency
        latency: {threshold_ms: 1000}
```

### 4.3 内存保护

```yaml
processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 1500      # 内存上限 1.5GB
    spike_limit_mib: 512 # 突发上限 512MB
```

Pipeline 中必须放在第一个 Processor 位置：
```yaml
processors: [memory_limiter, resource, batch]
```

---

## 5. 排障指南

| 现象 | 排查方向 | 命令/方法 |
|------|---------|----------|
| 应用没有 Trace 上报 | SDK 初始化顺序、Endpoint 是否可达 | `curl http://otel-collector:4318` |
| Collector 内存暴涨 | 采样率过低、Batch 过大 | 查看 `otelcol_process_memory_rss` |
| Jaeger 看不到 Trace | Exporter 配置、Jaeger 是否启动 | 查看 Collector 日志 |
| Prometheus 没有 OTel 指标 | Scrape 配置、端口是否正确 | `curl http://otel-collector:8889/metrics` |
| 前端 CORS 错误 | 后端是否允许 `traceparent` header | 浏览器 DevTools Network |
