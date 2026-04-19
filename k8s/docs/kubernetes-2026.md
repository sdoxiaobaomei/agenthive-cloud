# Kubernetes 2025-2026 新特性与最佳实践

> **最后更新**: 2026-04-15 | **校验状态**: 已二次核验
> 
> 涵盖 Kubernetes 1.31 ~ 1.33 的关键毕业特性，以及生产环境的最新最佳实践。

---

## 目录

1. [1.33 重要毕业特性](#133-重要毕业特性)
2. [自动扩缩容演进](#自动扩缩容演进)
3. [Pod 安全与加固](#pod-安全与加固)
4. [可观测性集成](#可观测性集成)
5. [GitOps 与服务网格](#gitops-与服务网格)

---

## 1.33 重要毕业特性

Kubernetes 1.33 (代号 Octarine) 于 2025 年 4 月发布，共有 **18 个特性毕业到 Stable**。

### Sidecar Containers（原生支持）

**状态**: Stable (1.33)

在 1.33 之前，Init 容器按顺序执行，Sidecar（如日志代理、监控 Agent）需要在主容器启动后手动管理生命周期。1.33 引入了**原生 Sidecar 容器**支持：

- `restartPolicy: Always` 的 Init 容器即为 Sidecar
- Sidecar 在主容器启动**之前**开始运行
- 主容器停止后，Sidecar **继续运行**，便于日志刷新和优雅关闭

```yaml
apiVersion: v1
kind: Pod
spec:
  initContainers:
    - name: fluent-bit
      image: fluent/fluent-bit:3.0
      restartPolicy: Always  # ← Sidecar 容器
      volumeMounts:
        - name: varlog
          mountPath: /var/log
  containers:
    - name: app
      image: my-app:v1.0
      volumeMounts:
        - name: varlog
          mountPath: /var/log
```

### Traffic Distribution for Services

**状态**: Stable (1.33)

替代传统的 `topologyKeys`，`trafficDistribution` 字段提供了更直观的拓扑感知路由：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  trafficDistribution: PreferClose  # 优先路由到同可用区/同区域
  ports:
    - port: 80
```

取值：
- `PreferClose` — 优先保持流量在拓扑最近的位置（降低延迟和跨区成本）

### Gateway API

**状态**: 持续演进，v1.2+ 已广泛可用

Ingress 的下一代标准，支持更细粒度的流量管理（HTTP 路由、TLS、流量分割、跨命名空间）。

**推荐迁移路径**：
- 新集群直接部署 **Gateway API**（使用 Ingress-nginx 2.x、Traefik、Istio 等实现）
- 旧集群可逐步将 Ingress 迁移到 HTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agenthive-gateway
spec:
  gatewayClassName: nginx
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        certificateRefs:
          - name: agenthive-tls
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
spec:
  parentRefs:
    - name: agenthive-gateway
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api
          port: 3001
```

### nftables kube-proxy backend

**状态**: Stable (1.33)

- `kube-proxy` 新增 **nftables** 后端（替代 iptables），使用单一规则 + 裁决映射表，解决 iptables 模式长期存在的性能问题
- 对于大规模集群（>1000 Service），nftables 模式可显著降低延迟和 CPU 占用
- 计划 Kubernetes 1.33 GA

```bash
# AKS/EKS/GKE 逐步支持，自建集群可手动启用
kube-proxy --proxy-mode nftables
```

---

## 自动扩缩容演进

### HPA 的局限

- 只能按 CPU/内存/自定义指标扩缩 Pod
- 无法优化节点利用率（小规格节点碎片、大规格节点超配）
- 扩容有分钟级延迟

### Karpenter：节点级自动扩缩容（推荐）

**Karpenter** 是 AWS 开源的节点自动供应工具，现已扩展支持 Azure、GKE 等云平台。

#### Karpenter vs Cluster Autoscaler

| 维度 | Karpenter | Cluster Autoscaler |
|------|-----------|-------------------|
| 启动速度 | **秒级**（无需预配置节点组） | 分钟级（依赖节点组模板） |
| 实例选择 | 动态选择最优实例类型 | 固定节点组实例类型 |
| 碎片整理 | 自动整合和漂移 | 有限 |
| 版本要求 | K8s >= 1.25 | 通用 |

#### Karpenter 兼容性（已核验）

| K8s 版本 | Karpenter 最低版本 |
|----------|-------------------|
| 1.29 | >= 0.34 |
| 1.31 | >= 1.0.5 |
| 1.32 | >= 1.2 |
| 1.33 | >= 1.5 |
| 1.34 | >= 1.6 |
| 1.35 | 1.9.x |

#### NodePool 配置示例

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values: ["t3.medium", "t3.large", "m6i.large"]
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
  disruption:
    budgets:
      - nodes: "10%"  # 同时中断的节点比例上限
    consolidationPolicy: WhenUnderutilized
    expireAfter: 720h  # 30 天后回收节点
```

#### Karpenter 最佳实践

1. **先升级 CRD，再升级 Controller**：Helm 不会自动升级 CRD
2. **NodePool 必须设置 disruption budgets**：防止大规模节点同时中断
3. **推荐部署在 `kube-system`**：获得 API Priority and Fairness 更高优先级
4. **Spot 实例配合 PodDisruptionBudget**：保证业务可用性

---

## Pod 安全与加固

### Pod Security Standards (PSS)

Kubernetes 原生提供了三种安全级别：

| 级别 | 说明 |
|------|------|
| **privileged** | 无限制 |
| **baseline** | 最小限制，防止已知高危配置 |
| **restricted** | 最严格，遵循 Pod 加固最佳实践 |

### 使用 Pod Security Admission

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: agenthive
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 生产级 Pod 安全配置模板

```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: my-app:v1.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
        runAsUser: 1000
        runAsGroup: 1000
      resources:
        requests:
          memory: "256Mi"
          cpu: "250m"
        limits:
          memory: "512Mi"
          cpu: "500m"
```

---

## 可观测性集成

### 日志收集架构（2025-2026 推荐）

```
应用 stdout/stderr
    ↓
Fluent Bit (DaemonSet) / Vector
    ↓
Elasticsearch / OpenSearch / Loki
    ↓
Kibana / Grafana
```

> **12-Factor 原则**：应用日志输出到 stdout/stderr，由集群统一采集。不要写入容器内文件或 bind mount 目录。

### 指标监控栈

```
Prometheus (或 VictoriaMetrics)
    ↓
Grafana (预配置 Dashboard)
```

### 追踪（可选）

- **OpenTelemetry Collector** 统一接收 traces/metrics/logs
- **Jaeger/Tempo** 存储和查询链路追踪

### 在 AgentHive 中的集成点

| 组件 | 监控方式 | 说明 |
|------|----------|------|
| API / Landing | PodMonitor (Prometheus Operator) | 暴露 `/metrics` 端点 |
| PostgreSQL | postgres_exporter | 数据库指标 |
| Redis | redis_exporter | 缓存指标 |
| Nginx Ingress | nginx-prometheus-exporter | 入口流量指标 |
| 容器日志 | Fluent Bit → Elasticsearch | 集中日志分析 |

---

## GitOps 与服务网格

### GitOps 推荐工具

| 工具 | 特点 | 适用场景 |
|------|------|----------|
| **ArgoCD** | UI 强大、支持多源、ApplicationSet | 大多数团队首选 |
| **Flux** | 原生 GitOps、与 Helm 集成深 | Azure/云原生团队 |

### ArgoCD 基础结构

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: agenthive
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/agenthive-cloud.git
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: agenthive-production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### 服务网格：何时引入 Istio/Linkerd？

| 场景 | 建议 |
|------|------|
| 微服务 < 10 个 | **不需要**服务网格，Ingress + NetworkPolicy 足够 |
| 需要 mTLS 自动注入 | Istio/Linkerd 是优选 |
| 需要高级流量管理（金丝雀、熔断） | Istio + Argo Rollouts |
| 需要最小侵入性 | Linkerd（轻量、简单） |

### 渐进式采纳建议

1. **阶段 1**：Kustomize + Ingress + HPA + NetworkPolicy（已完成）
2. **阶段 2**：引入 Prometheus + Grafana + ELK（正在补充）
3. **阶段 3**：ArgoCD GitOps 自动化部署
4. **阶段 4**：Karpenter 节点自动优化
5. **阶段 5**：Gateway API + 服务网格（按需）
