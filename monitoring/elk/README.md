# ELK 可观测系统

> **最后更新**: 2026-04-15 | **校验状态**: 已二次核验
> 
> 本目录包含 Elasticsearch + Logstash/Fluent Bit + Kibana 的完整可观测方案，覆盖本地 Docker Compose 测试和 Kubernetes ECK 生产部署。

---

## 目录

1. [架构概览](#架构概览)
2. [本地快速开始（Docker Compose）](#本地快速开始docker-compose)
3. [Kubernetes 生产部署（ECK）](#kubernetes-生产部署eck)
4. [日志采集最佳实践](#日志采集最佳实践)
5. [索引生命周期管理（ILM）](#索引生命周期管理ilm)
6. [安全与性能建议](#安全与性能建议)

---

## 架构概览

### 现代日志架构（推荐）

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│  Application │────→│  Fluent Bit  │────→│ Elasticsearch│────→│   Kibana    │
│  stdout/stderr│     │  (DaemonSet) │     │   Cluster    │     │  Dashboard  │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                           │
                           ↓
                    ┌──────────────┐
                    │   Logstash   │  (可选：复杂解析/过滤)
                    └──────────────┘
```

### 组件职责

| 组件 | 职责 | 部署方式 |
|------|------|----------|
| **Fluent Bit** | 轻量级日志采集与转发 | K8s DaemonSet / 宿主机 Agent |
| **Logstash** | 复杂日志解析、过滤、富化 | K8s StatefulSet / 独立 VM |
| **Elasticsearch** | 日志存储、索引、搜索 | K8s ECK / 托管服务 / VM 集群 |
| **Kibana** | 可视化查询、Dashboard、告警 | K8s ECK / 独立 VM |

> **2025-2026 主流趋势**：Fluent Bit 已全面取代 Filebeat 成为容器环境首选采集器；Elasticsearch 8.19+ 默认启用安全特性（TLS + 认证）。

---

## 本地快速开始（Docker Compose）

```bash
cd monitoring/elk

# 启动 ELK 栈
docker-compose up -d

# 查看状态
docker-compose ps

# 访问 Kibana
open http://localhost:5601
# 默认账号: elastic / elastic123
```

### 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Elasticsearch | 9200 | REST API |
| Kibana | 5601 | Web UI |
| Fluent Bit | 24224 | 日志接收端口 |

---

## Kubernetes 生产部署（ECK）

### 什么是 ECK

**Elastic Cloud on Kubernetes (ECK)** 是 Elastic 官方 Kubernetes Operator，支持：

- 一键部署 Elasticsearch + Kibana
- 自动化滚动升级、扩缩容
- 默认启用 TLS 和内置用户认证
- 自动故障恢复和持久卷管理

### 安装 ECK Operator

```bash
# 安装 CRD
kubectl create -f https://download.elastic.co/downloads/eck/3.3.2/crds.yaml

# 安装 Operator
kubectl apply -f https://download.elastic.co/downloads/eck/3.3.2/operator.yaml

# 验证
kubectl get pods -n elastic-system
```

### 部署生产级 Elasticsearch 集群

参见 [`k8s/elasticsearch-production.yaml`](k8s/elasticsearch-production.yaml)：

- 3 节点 Master（高可用）
- 3 节点 Data（热数据）
- 持久化存储（SSD StorageClass）
- 资源限制与反亲和性

### 部署 Kibana

参见 [`k8s/kibana.yaml`](k8s/kibana.yaml)：

```bash
# 获取 elastic 用户密码
kubectl get secret production-es-elastic-user \
  -n elasticsearch \
  -o jsonpath='{.data.elastic}' | base64 -d

# 端口转发访问 Kibana
kubectl port-forward service/production-kb-http 5601:5601 -n elasticsearch
```

### 部署 Fluent Bit

参见 [`k8s/fluent-bit.yaml`](k8s/fluent-bit.yaml)：

- 以 DaemonSet 运行在每个节点
- 采集容器 stdout/stderr
- 通过 HTTPS 直写 Elasticsearch

---

## 日志采集最佳实践

### 12-Factor 日志原则

1. **应用只输出到 stdout/stderr**，不写文件
2. **使用结构化日志**（JSON 格式），便于解析和索引
3. **Fluent Bit 统一采集**，不要依赖 Docker json-file
4. **日志分级**：ERROR/WARN/INFO/DEBUG 明确区分

### Fluent Bit 配置要点

```ini
[INPUT]
    Name              tail
    Path              /var/log/containers/*.log
    Parser            docker
    Tag               kube.*
    Mem_Buf_Limit     5MB
    Skip_Long_Lines   On
    Refresh_Interval  10

[FILTER]
    Name                kubernetes
    Match               kube.*
    Kube_URL            https://kubernetes.default.svc:443
    Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
    Merge_Log           On
    Keep_Log            Off

[OUTPUT]
    Name            es
    Match           kube.*
    Host            production-es-http
    Port            9200
    Index           kubernetes-logs-%Y.%m.%d
    HTTP_User       elastic
    HTTP_Passwd     ${ELASTIC_PASSWORD}
    tls             On
    tls.verify      Off
    Suppress_Type_Name On
```

---

## 索引生命周期管理（ILM）

Elasticsearch 日志数据具有明显的时间特征，建议使用 **Index Lifecycle Management (ILM)** 自动化管理：

| 阶段 | 天数 | 动作 |
|------|------|------|
| Hot | 0-7 | 活跃写入，使用 SSD |
| Warm | 7-30 | 只读，迁移到标准盘，压缩 |
| Cold | 30-90 | 低频访问，进一步压缩 |
| Delete | > 90 | 自动删除 |

### ILM 策略示例

```json
PUT _ilm/policy/kubernetes-logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50gb",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "searchable_snapshot": { "snapshot_repository": "found-snapshots" }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

---

## 安全与性能建议

### 安全 checklist

| # | 项目 | 说明 |
|---|------|------|
| 1 | TLS 传输加密 | ECK 默认开启，不要禁用 |
| 2 | 认证授权 | 使用 `elastic` 用户 + RBAC 角色 |
| 3 | 网络隔离 | Elasticsearch 仅允许 Fluent Bit / Kibana 访问 |
| 4 | 敏感数据脱敏 | 在 Fluent Bit 中使用 `modify` filter 过滤密码、Token |
| 5 | 快照备份 | 配置 S3/GCS/OSS Snapshot Repository |

### 性能优化

| 维度 | 建议 |
|------|------|
| JVM Heap | 设置为物理内存的 50%，最大不超过 30GB |
| 分片大小 | 单个分片控制在 20-50GB 之间 |
| 刷新间隔 | 日志场景可设置为 30s，降低索引压力 |
| 批量写入 | Fluent Bit 配置 `Buffer_Size` 和 `Trace_Output` 调优 |
| 存储类型 | 热数据使用 SSD，温/冷数据可降配 |

### 关键指标监控

- **集群健康**: `GET _cluster/health`
- **节点 JVM**: `GET _nodes/stats/jvm`
- **索引速率**: `GET _cat/count`
- **慢查询**: `GET _cluster/nodes/hot_threads`
