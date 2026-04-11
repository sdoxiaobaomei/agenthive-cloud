# 🔥 Kubernetes 高频面试题 50 问（2024-2025 版）

> 涵盖 K8s 1.29+、Gateway API、eBPF、Sigstore、Karpenter 等最新技术栈

---

## 📑 目录

- [一、基础概念篇（10题）](#一基础概念篇10题)
- [二、资源管理篇（10题）](#二资源管理篇10题)
- [三、网络与安全篇（10题）](#三网络与安全篇10题)
- [四、存储与有状态应用篇（5题）](#四存储与有状态应用篇5题)
- [五、可观测性篇（5题）](#五可观测性篇5题)
- [六、高级特性与生态篇（10题）](#六高级特性与生态篇10题)

---

## 一、基础概念篇（10题）

### Q1: K8s 中 Pod 和 Container 的区别是什么？为什么需要 Pod 这个抽象？

**A:**

- **Container** 是应用运行的最小单元，共享宿主机内核
- **Pod** 是 K8s 调度的最小单元，可以包含多个容器（Sidecar 模式）

**设计原因**：
1. 紧密耦合的容器共享 Network Namespace（localhost 通信）
2. 共享 Storage Volume
3. 统一生命周期管理（同时创建/销毁）
4. 支持 Init Container 初始化逻辑

---

### Q2: K8s 1.29+ 有哪些值得关注的新特性？

**A:**

| 特性 | 说明 |
|------|------|
| **Sidecar Containers** (GA) | 原生支持 Sidecar，保证 Init 容器先启动且后终止 |
| **In-Place Pod Resize** (Beta) | 不停机调整 Pod 资源限制 |
| **NFTABLES backend** | kube-proxy 新后端，替代 iptables，性能提升 |
| **ImagePullSecrets 自动化** | 镜像拉取密钥自动注入 Pod |
| **PodReadyToStartContainers** | 更精确的容器启动状态条件 |

---

### Q3: Deployment 的滚动更新策略中，`maxSurge` 和 `maxUnavailable` 如何配合实现零停机？

**A:**

```yaml
strategy:
  rollingUpdate:
    maxSurge: 25%        # 最多超出期望副本数的比例
    maxUnavailable: 0    # 最少不可用副本数
```

- **零停机配置**: `maxUnavailable: 0` + `maxSurge: 25%`
- 先创建新 Pod（不超过 125%），再删除旧 Pod
- **快速回滚配置**: `maxUnavailable: 50%` + `maxSurge: 0`（节省资源）

---

### Q4: K8s 的 QoS 等级有哪些？如何影响 Pod 被驱逐的顺序？

**A:**

| QoS 等级 | 条件 | 驱逐优先级 |
|----------|------|-----------|
| **Guaranteed** | 所有容器都有 limits=requests | 最后 |
| **Burstable** | 至少一个容器有 limits≠requests | 中等 |
| **BestEffort** | 没有任何资源设置 | 最先 |

**驱逐顺序**: BestEffort → Burstable（按使用率排序）→ Guaranteed

---

### Q5: 为什么 StatefulSet 的 Headless Service 要设置 `clusterIP: None`？

**A:**

- **有状态应用**需要稳定的网络标识（Pod 名字解析到 IP）
- Headless Service 直接返回 Pod IP 列表，不走 kube-proxy 负载均衡
- 支持 DNS 直接解析到具体 Pod：`pod-0.postgres.agenthive.svc.cluster.local`
- 配合 `volumeClaimTemplates` 实现每个 Pod 独占存储

---

### Q6: kubectl 的 `apply`、`create`、`replace` 有什么区别？

**A:**

| 命令 | 行为 | 使用场景 |
|------|------|----------|
| `create` | 新建资源，已存在则报错 | CI/CD 首次部署 |
| `apply` | 声明式更新，合并配置 | 日常开发/持续部署 |
| `replace` | 完全替换资源（先删后建） | 需要重建资源时 |

**核心区别**: `apply` 使用 `kubectl.kubernetes.io/last-applied-configuration` 注解实现三路合并

---

### Q7: K8s 的 Taint 和 Toleration 是什么关系？常见应用场景？

**A:**

```bash
# 给节点打污点（排斥 Pod）
kubectl taint nodes node1 dedicated=gpu:NoSchedule

# Pod 容忍污点
tolerations:
- key: "dedicated"
  operator: "Equal"
  value: "gpu"
  effect: "NoSchedule"  # 或 PreferNoSchedule/NoExecute
```

**场景**：
- 专用节点（GPU/SSD）
- 节点维护（驱逐 Pod）
- master 节点隔离

---

### Q8: 什么是 K8s 的 Ephemeral Container？什么时候用？

**A:**

- **临时容器**: 在运行中的 Pod 里动态添加的调试容器
- **命令**: `kubectl debug -it pod-name --image=nicolaka/netshoot --target=app-container`
- **特点**：
  - 共享目标容器的 PID/Network Namespace
  - 不重启 Pod，用完即弃
  - 用于线上问题排查（抓包、看进程）

---

### Q9: K8s 的 LimitRange 和 ResourceQuota 有什么区别？

**A:**

| 对象 | 作用范围 | 功能 |
|------|----------|------|
| **LimitRange** | Pod/Container | 设置默认资源限制、最小/最大资源约束 |
| **ResourceQuota** | Namespace | 限制命名空间总资源使用量（CPU/Memory/Pod数） |

**使用顺序**: 先设 ResourceQuota 限制总量 → 再用 LimitRange 限制单个 Pod

---

### Q10: 解释 K8s 的 PreStop Hook 和优雅终止流程

**A:**

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 15"]  # 等待负载均衡摘除
```

**终止流程**：
1. Pod 被标记为 Terminating
2. 执行 PreStop Hook（同步阻塞）
3. 发送 SIGTERM 信号
4. 等待 `terminationGracePeriodSeconds`（默认30s）
5. 超时后发送 SIGKILL

---

## 二、资源管理篇（10题）

### Q11: HPA v2 和 v1 的区别？如何配置自定义指标扩缩容？

**A:**

```yaml
# HPA v2 支持多指标+行为配置
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  metrics:
  - type: Resource          # 资源指标
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods              # Pod 指标
    pods:
      metric:
        name: packets-per-second
      target:
        type: AverageValue
        averageValue: 1k
  - type: External          # 外部指标（Prometheus）
    external:
      metric:
        name: queue_length
      target:
        type: Value
        value: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 缩容冷静期
```

---

### Q12: Karpenter 相比 Cluster Autoscaler 有什么优势？

**A:**

| 特性 | Cluster Autoscaler | Karpenter |
|------|-------------------|-----------|
| **节点池管理** | 基于 ASG/MIG（固定配置） | 动态选择实例类型（灵活） |
| **扩容速度** | 分钟级 | 秒级（直接创建实例） |
| **调度感知** | 需要 pending Pod | 直接模拟调度 |
| **实例类型** | 预定义 | 自动选择最优价格/性能 |
| **整合云厂商** | 依赖特定实现 | 统一抽象（支持 AWS/Azure/GCP） |

**Karpenter 配置**：

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
spec:
  template:
    spec:
      requirements:
      - key: karpenter.k8s.aws/instance-category
        operator: In
        values: ["c", "m", "r"]
      - key: karpenter.sh/capacity-type
        operator: In
        values: ["spot", "on-demand"]
```

---

### Q13: 什么是 In-Place Pod Resize？如何配置？

**A:**

- **功能**: 不停机调整 Pod 的 CPU/Memory 限制（K8s 1.27+ Beta）
- **使用场景**: 业务高峰期临时扩容，避免滚动更新

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    resources:
      limits:
        cpu: "500m"
      resizePolicy:
      - resourceName: cpu
        restartPolicy: NotRequired  # 不需要重启
```

**限制**：
- 仅支持 CPU/Memory
- 不能小于 requests
- 节点要有足够资源

---

### Q14: 如何防止 Namespace 资源耗尽导致的集群雪崩？

**A:**

```yaml
# ResourceQuota 配置
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 100Gi
    limits.cpu: "40"
    limits.memory: 200Gi
    pods: "100"
    persistentvolumeclaims: "20"
    services.loadbalancers: "5"    # 防止 LB 费用过高
```

**额外保护**：
- LimitRange 设置默认 limits
- PodDisruptionBudget 保证最小可用
- PriorityClass 保证核心服务资源

---

### Q15: 解释 PriorityClass 和 Preemption（抢占）机制

**A:**

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "核心系统服务"
preemptionPolicy: PreemptLowerPriority  # 或 Never
```

**抢占流程**：
1. 高优先级 Pod Pending
2. 调度器寻找可牺牲的 Pod（低优先级）
3. 驱逐低优先级 Pod
4. 高优先级 Pod 调度到节点

**场景**: 核心服务 > 普通业务 > 离线任务（如日志采集）

---

### Q16: Vertical Pod Autoscaler (VPA) 的适用场景和限制？

**A:**

**适用场景**：
- 批处理作业（一次性任务）
- 单实例服务（如数据库代理）
- 历史数据不足无法配置 HPA

**限制**：
- 与 HPA 同时使用时，只能基于自定义指标
- 重建 Pod（非原地更新）
- 不适用于有状态应用

**模式**：
- `Off`: 仅推荐
- `Initial`: 启动时设置
- `Auto`: 自动更新（重建 Pod）
- `Recreate`: 始终重建更新

---

### Q17: 如何优雅地管理 K8s 配置的多环境差异？

**A:**

**方案对比**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Kustomize** | 原生支持，无模板语言 | 复杂逻辑支持弱 |
| **Helm** | 模板强大，生态丰富 | 学习曲线高，Tiller 安全风险 |
| **Cue** | 类型安全，配置即代码 | 社区较小 |
| **Jsonnet** | 灵活，Google 出品 | 学习成本高 |

**推荐**: Kustomize 用于简单场景，Helm 用于复杂应用分发

---

### Q18: 解释 K8s 的 Topology Spread Constraints（拓扑分布约束）

**A:**

```yaml
topologySpreadConstraints:
- maxSkew: 1                    # 最大分布差异
  topologyKey: topology.kubernetes.io/zone  # 按可用区分布
  whenUnsatisfiable: DoNotSchedule          # 不满足时不调度
  labelSelector:
    matchLabels:
      app: api
- maxSkew: 1
  topologyKey: kubernetes.io/hostname       # 按节点分布
  whenUnsatisfiable: ScheduleAnyway         # 尽量满足
```

**作用**: 比 PodAntiAffinity 更精细的分布控制，确保高可用

---

### Q19: 什么是 Descheduler？什么时候需要它？

**A:**

- **功能**: 自动重新调度运行中的 Pod，优化集群资源分布
- **场景**：
  1. 节点资源碎片化
  2. Pod 分布不均（某些节点过载）
  3. 新节点加入后重新平衡
  4. 污点变化后驱逐不合规 Pod

**策略**：
- `RemoveDuplicates`: 删除重复 Pod
- `LowNodeUtilization`: 利用率低时重新分布
- `RemovePodsViolatingTopologySpreadConstraint`: 修复拓扑分布

---

### Q20: 如何处理 K8s 中的镜像拉取失败问题？

**A:**

**排查步骤**：
1. `kubectl describe pod` 查看 Events
2. 检查 ImagePullSecrets: `kubectl get secret regcred`
3. 验证镜像 tag 存在且仓库可访问
4. 检查节点磁盘空间（`No space left on device`）

**高级配置**：

```yaml
imagePullSecrets:
- name: regcred
imagePullPolicy: IfNotPresent  # 优先本地缓存
# 或 Always（强制拉取最新）
```

**私有仓库镜像缓存**: 使用 kube-fledged 或 Dragonfly

---

## 三、网络与安全篇（10题）

### Q21: Cilium 相比 Calico/Flannel 有什么优势？

**A:**

| 特性 | Cilium | Calico | Flannel |
|------|--------|--------|---------|
| **数据平面** | eBPF | iptables/IPVS | iptables |
| **性能** | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **可观测性** | Hubble（L3-L7） | 基础 | 无 |
| **Service Mesh** | 原生支持 | 需配合 Istio | 不支持 |
| **Network Policy** | L3-L7 | L3-L4 | 不支持 |
| **Cluster Mesh** | 原生支持 | 支持 | 不支持 |

**Cilium 独有功能**：
- 基于身份的安全（非 IP）
- L7 协议感知（HTTP/gRPC/Kafka）
- 带宽管理
- 透明加密（WireGuard/IPsec）

---

### Q22: 什么是 Gateway API？为什么取代 Ingress？

**A:**

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: external-gateway
spec:
  gatewayClassName: nginx          # 实现类
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    hostname: "*.agenthive.cloud"
    tls:
      certificateRefs:
      - name: wildcard-cert
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
spec:
  parentRefs:
  - name: external-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api
      port: 3001
```

**优势**：
- 角色分离（基础架构 vs 应用团队）
- 支持多协议（HTTP/TCP/UDP/TLS）
- 更好的流量分割（权重、Header 匹配）
- 跨命名空间引用

---

### Q23: 如何配置 mTLS 实现服务间通信加密？

**A:**

**Istio 方案**：

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: agenthive
spec:
  mtls:
    mode: STRICT  # 强制 mTLS，或 PERMISSIVE（兼容）
```

**Cilium 方案**：

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: encrypt-api
spec:
  endpointSelector:
    matchLabels:
      app: api
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: landing
    toPorts:
    - ports:
      - port: "3001"
        protocol: TCP
      rules:
        http: [{}]
  encryption:
    enabled: true
```

---

### Q24: Network Policy 的默认拒绝策略怎么写？常见问题？

**A:**

```yaml
# 1. 默认拒绝所有入口流量
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}  # 所有 Pod
  policyTypes:
  - Ingress

# 2. 显式放行特定流量
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-from-landing
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: landing
    ports:
    - protocol: TCP
      port: 3001
```

**常见问题**：
- 忘记放行 DNS（UDP 53）
- 顺序问题（deny-all 要在最后或最先？）
- 跨命名空间流量需要 namespaceSelector

---

### Q25: OPA Gatekeeper / Kyverno 怎么用策略管理 K8s？

**A:**

**OPA Gatekeeper**：

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-labels
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Namespace"]
  parameters:
    labels:
    - key: "team"
      allowedRegex: "^[a-z]+$"
```

**Kyverno**（更易用）：

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resources
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-limits
    match:
      resources:
        kinds:
        - Pod
    validate:
      message: "必须设置资源限制"
      pattern:
        spec:
          containers:
          - resources:
              limits:
                memory: "?*"
                cpu: "?*"
```

---

### Q26: 什么是 Sigstore/Cosign？如何保证镜像供应链安全？

**A:**

**工作流程**：

```bash
# 1. 构建镜像后签名
cosign sign --key cosign.key myrepo/api:v1.0.0

# 2. 验证签名（K8s admission webhook）
cosign verify --key cosign.pub myrepo/api:v1.0.0

# 3. 配合 Kyverno 强制验证
```

**Kyverno 策略**：

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-signature
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-image-signature
    match:
      resources:
        kinds:
        - Pod
    verifyImages:
    - imageReferences:
      - "myrepo/*"
      attestors:
      - entries:
        - keys:
            publicKeys: |
              -----BEGIN PUBLIC KEY-----
              ...
```

---

### Q27: K8s 的 PSA (Pod Security Admission) 怎么使用？

**A:**

**替代 PodSecurityPolicy (已弃用)**：

```yaml
# 命名空间级别启用
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted    # 强制
    pod-security.kubernetes.io/audit: restricted     # 审计
    pod-security.kubernetes.io/warn: baseline        # 警告
```

**三种级别**：
- **Privileged**: 无限制
- **Baseline**: 最小限制（阻止特权容器、hostPath 等）
- **Restricted**: 最严格（非 root、只读根文件系统等）

---

### Q28: 如何审计 K8s 集群的操作行为？

**A:**

**审计日志配置**：

```yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata        # 记录元数据
  resources:
  - group: ""
    resources: ["pods"]
  omitStages:
  - RequestReceived
  
- level: RequestResponse  # 记录完整请求响应
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
  namespaces: ["production"]
```

**配合 Falco 实时告警**：

```yaml
- rule: Unauthorized Pod Creation
  desc: 检测未授权用户创建 Pod
  condition: >
    k8s.audit.objectref.resource = "pods" and
    k8s.audit.verb = "create" and
    user.name != "system:serviceaccount:default:deployer"
  output: "Unauthorized pod creation detected"
  priority: WARNING
```

---

### Q29: 解释 K8s 的 Ephemeral Containers 安全注意事项

**A:**

**风险**：
- 可以进入任何运行中的 Pod
- 可能绕过安全策略

**防护**：

```yaml
# 限制 ephemeral containers 使用
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: restricted-debug
rules:
- apiGroups: [""]
  resources: ["pods/ephemeralcontainers"]
  verbs: ["create", "update"]
  resourceNames: ["debug-*"]  # 仅允许特定命名
```

**最佳实践**：
- 仅赋予特定用户 debug 权限
- 使用审计日志记录 ephemeral container 创建
- 结合 Network Policy 限制调试容器网络

---

### Q30: 如何防止 K8s Secret 被意外提交到 Git？

**A:**

**多层防护**：

1. **Git 层面**: pre-commit hooks

```yaml
# .pre-commit-config.yaml
repos:
- repo: https://github.com/Yelp/detect-secrets
  hooks:
  - id: detect-secrets
```

2. **CI 层面**: Secret 扫描
- GitLeaks
- TruffleHog

3. **K8s 层面**: 使用 Sealed Secrets / External Secrets

```yaml
# Sealed Secrets - 提交加密后的 secret
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: my-secret
spec:
  encryptedData:
    password: AgByBBg...
```

---

## 四、存储与有状态应用篇（5题）

### Q31: StatefulSet 的 `podManagementPolicy: Parallel` 和 `OrderedReady` 区别？

**A:**

| 策略 | 行为 | 适用场景 |
|------|------|----------|
| **OrderedReady** | 顺序创建/删除（0→1→2） | 需要数据同步（如 MySQL 主从）|
| **Parallel** | 并行创建/删除 | 无数据依赖（如 ZooKeeper）|

**注意**: 即使 Parallel，StatefulSet 的 Pod 名字和网络标识仍然稳定

---

### Q32: 如何选择 K8s 存储方案？Local PV vs CSI vs hostPath？

**A:**

| 方案 | 性能 | 可用性 | 场景 |
|------|------|--------|------|
| **hostPath** | 最高 | 差（节点绑定） | 单节点测试 |
| **Local PV** | 高 | 中（需配合 Pod 亲和性） | 高 IO 数据库 |
| **CSI（云盘）** | 中 | 高 | 通用生产环境 |
| **NFS/Ceph** | 中 | 高 | 共享存储（RWX）|

**Local PV 配置**：

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-ssd
provisioner: kubernetes.io/no-provisioner  # 手动创建 PV
volumeBindingMode: WaitForFirstConsumer     # 延迟绑定，调度后创建
```

---

### Q33: 什么是 Volume Snapshots？如何备份有状态应用？

**A:**

```yaml
# 1. 创建 VolumeSnapshot
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: postgres-snapshot
spec:
  volumeSnapshotClassName: csi-snapclass
  source:
    persistentVolumeClaimName: postgres-data

# 2. 从 Snapshot 恢复
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data-restore
spec:
  storageClassName: standard
  dataSource:
    name: postgres-snapshot
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  resources:
    requests:
      storage: 10Gi
```

**完整备份方案**: Velero（集群级备份）+ CSI Snapshots（PV 数据）

---

### Q34: 解释 ReadWriteOnce (RWO)、ReadOnlyMany (ROX)、ReadWriteMany (RWX) 区别？

**A:**

| 模式 | 说明 | 存储类型 |
|------|------|----------|
| **RWO** | 单节点读写 | 云盘、Local PV |
| **ROX** | 多节点只读 | NFS、CephFS |
| **RWX** | 多节点读写 | NFS、CephFS、EFS |

**注意**：
- RWO 不能跨节点，StatefulSet 的 Pod 必须和 PV 在同一节点
- RWX 适合共享存储（如 AI 训练数据集）

---

### Q35: 如何处理有状态应用的配置变更？

**A:**

**ConfigMap/Secret 热更新问题**：
- 修改 ConfigMap 不会自动重启 Pod
- Secret 需要重新挂载才会更新

**解决方案**：

1. **Reloader**: 自动检测 ConfigMap/Secret 变化并滚动更新

2. **Stakater/Reloader**：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  annotations:
    configmap.reloader.stakater.com/reload: "app-config"
    secret.reloader.stakater.com/reload: "app-secrets"
```

3. **Sidecar 模式**: 监听文件变化，通知主容器热加载

---

## 五、可观测性篇（5题）

### Q36: Prometheus 的 ServiceMonitor 和 PodMonitor 区别？

**A:**

```yaml
# ServiceMonitor - 通过 Service 发现 Pod
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
spec:
  selector:
    matchLabels:
      app: api
  endpoints:
  - port: metrics    # Service 中定义的端口名
    interval: 15s

# PodMonitor - 直接发现 Pod（无 Service 场景）
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
spec:
  selector:
    matchLabels:
      app: sidecar-exporter
  podMetricsEndpoints:
  - port: 9090
    path: /metrics
```

---

### Q37: 什么是 OpenTelemetry？如何替换 Prometheus + Jaeger？

**A:**

**统一可观测性标准**：

```yaml
# OpenTelemetry Collector 配置
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
spec:
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
          http:
    processors:
      batch:
    exporters:
      prometheusremotewrite:
        endpoint: http://prometheus:9090/api/v1/write
      otlp/jaeger:
        endpoint: jaeger:4317
    service:
      pipelines:
        metrics:
          receivers: [otlp]
          processors: [batch]
          exporters: [prometheusremotewrite]
        traces:
          receivers: [otlp]
          exporters: [otlp/jaeger]
```

**优势**: 一套 SDK 同时采集 Metrics/Logs/Traces

---

### Q38: 如何设置 K8s 告警的黄金指标？

**A:**

```yaml
# PrometheusRule 示例
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: k8s-alerts
spec:
  groups:
  - name: kubernetes
    rules:
    # 1. Pod 异常重启
    - alert: PodCrashLooping
      expr: rate(kube_pod_container_status_restarts_total[5m]) > 0
      for: 5m
      labels:
        severity: critical
      
    # 2. 节点磁盘压力
    - alert: NodeDiskPressure
      expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
      for: 5m
      
    # 3. Pod 资源不足被 OOMKilled
    - alert: PodOOMKilled
      expr: kube_pod_container_status_terminated_reason{reason="OOMKilled"} == 1
      
    # 4. HPA 达到上限
    - alert: HPAMaxReplicas
      expr: kube_horizontalpodautoscaler_status_current_replicas == kube_horizontalpodautoscaler_spec_max_replicas
```

---

### Q39: 什么是 eBPF 在可观测性中的作用？

**A:**

**传统方式**: 插桩代码或 Sidecar 采集

**eBPF 方式**: 内核级无侵入采集

**能力**：
- 自动 HTTP/gRPC 追踪（无需应用修改）
- TCP 连接指标
- 网络丢包/延迟分析
- 安全事件检测

**工具**：
- **Pixie**: K8s 应用可观测性
- **Hubble** (Cilium): 网络流可视化
- **Tetragon** (Cilium): 安全可观测性

---

### Q40: 如何实现 K8s 成本监控？

**A:**

**Kubecost/OpenCost**：

```bash
# 查看每个命名空间的成本
kubectl cost namespace --window 7d

# Pod 级别成本
kubectl cost pod --show-all-resources
```

**优化建议**：
- 设置资源 requests/limits（避免过度分配）
- 使用 Spot 实例（Karpenter 自动选择）
- 清理闲置 PV
- 设置 TTL 自动删除 Job

---

## 六、高级特性与生态篇（10题）

### Q41: 什么是 Cluster API？如何用声明式方式管理集群？

**A:**

**K8s 管理 K8s**：

```yaml
apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: production-cluster
spec:
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta1
    kind: KubeadmControlPlane
    name: control-plane
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
    kind: AWSCluster
    name: aws-cluster
```

**能力**：
- 声明式创建/升级/删除集群
- 多云统一管理（AWS/Azure/GCP）
- 自动修复节点

---

### Q42: GitOps 是什么？ArgoCD 的核心概念？

**A:**

**Git 作为唯一可信源**：

```
Git Repo (配置) --> ArgoCD --> K8s Cluster
     ↑                              |
     └──────── Git Webhook ←────────┘
```

**ArgoCD 核心**：
- **Application**: 管理一组 K8s 资源
- **AppProject**: 多租户隔离
- **ApplicationSet**: 多环境批量管理
- **自动同步**: Git 变更自动应用到集群
- **自动回滚**: 失败自动回退到上一个版本

---

### Q43: K8s 的 CRD 和 Operator 是什么关系？

**A:**

**关系**: CRD 定义数据结构，Operator 实现业务逻辑

**Operator 模式组件**：
1. **CRD**: 自定义资源定义
2. **Controller**: 监听 CR 变化，调和实际状态
3. **Admission Webhook**: 校验/修改请求

**开发框架**: Operator SDK / Kubebuilder

---

### Q44: 什么是 Sidecar 模式？K8s 1.29 原生 Sidecar 有什么改进？

**A:**

```yaml
# K8s 1.29+ 原生 Sidecar
initContainers:
- name: istio-proxy
  image: istio/proxyv2:latest
  restartPolicy: Always  # 关键：Sidecar 持续运行
  # 保证在主容器之前启动，之后终止
```

**改进**：
- 以前: Job 完成后 Sidecar 不退出，导致 Pod 卡住
- 现在: Sidecar 可以优雅退出，支持 Job 场景

---

### Q45: 如何设计 K8s 的多租户方案？

**A:**

**软多租户 vs 硬多租户**：

| 维度 | 软多租户 | 硬多租户 |
|------|----------|----------|
| **隔离级别** | Namespace | 独立集群/虚拟集群 |
| **安全边界** | RBAC + Network Policy | 物理隔离 |
| **成本** | 低 | 高 |
| **适用** | 内部团队 | SaaS/外部客户 |

**方案**：
- **Namespace + RBAC**: 基础隔离
- **HNC (Hierarchical Namespace)**: 层级命名空间
- **vCluster**: 轻量级虚拟集群
- **多集群**: 最强隔离

---

### Q46: K8s 的 CronJob 和 Job 的常见问题？

**A:**

```yaml
apiVersion: batch/v1
kind: CronJob
spec:
  schedule: "0 2 * * *"    # 每天 2 点
  concurrencyPolicy: Forbid  # 禁止并发
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600  # 超时 1 小时
      backoffLimit: 3              # 重试 3 次
      ttlSecondsAfterFinished: 86400  # 完成后保留 1 天
```

**常见问题**：
- 时区问题（默认 UTC）
- 任务堆积（设置 `startingDeadlineSeconds`）
- 资源泄漏（设置 TTL）

---

### Q47: 什么是 K8s 的 RuntimeClass？什么时候用？

**A:**

```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc  # gVisor 运行时
---
apiVersion: v1
kind: Pod
spec:
  runtimeClassName: gvisor  # 使用沙箱运行时
```

**场景**：
- 不可信代码运行（gVisor/Kata Containers）
- GPU 工作负载（NVIDIA Container Runtime）
- 特定硬件支持

---

### Q48: 如何处理 K8s 的 DNS 解析问题？

**A:**

**CoreDNS 配置优化**：

```yaml
# CoreDNS ConfigMap
.:53 {
    errors
    health
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30           # 缩短 TTL 加速变更感知
    }
    cache 30            # 缓存 30 秒
    reload
    loadbalance         # 轮询 A 记录
}
```

**常见问题**：
- ndots:5 导致大量无效 DNS 查询（设置 `options ndots:2`）
- CoreDNS 内存泄漏（限制内存）
- 外部域名解析慢（使用 NodeLocal DNSCache）

---

### Q49: 解释 K8s 的 Finalizers 和 OwnerReferences

**A:**

**Finalizers**: 阻止资源被删除，直到清理完成

```yaml
metadata:
  finalizers:
  - kubernetes.io/pvc-protection    # PVC 有 Pod 使用时阻止删除
  - custom-cleanup/my-finalizer     # 自定义清理逻辑
```

**OwnerReferences**: 级联删除

```yaml
ownerReferences:
- apiVersion: apps/v1
  kind: ReplicaSet
  name: api-7d4f9b2c1
  uid: a3b4c5d6...
  controller: true
  blockOwnerDeletion: true
```

- 删除 Deployment → 自动删除 ReplicaSet → 自动删除 Pod

---

### Q50: 作为 50W 年薪的 DevOps，如何设计一套完整的 K8s 交付流水线？

**A:**

**完整流水线设计**：

```yaml
阶段 1 - 代码提交:
├── Git Pre-commit Hook (Lint/Secret 扫描)
├── PR Review (Code Review + SonarQube)
└── 单元测试

阶段 2 - 镜像构建:
├── Dockerfile 多阶段构建
├── 镜像安全扫描 (Trivy/Snyk)
├── 镜像签名 (Cosign)
└── 推送到镜像仓库

阶段 3 - 配置验证:
├── Helm Lint / Kustomize Build
├── kubeval / kubeconform (Schema 验证)
├── Conftest (OPA 策略验证)
└── 成本估算 (Infracast)

阶段 4 - 测试环境:
├── ArgoCD 自动同步到 Staging
├── 集成测试 / E2E 测试
├── 性能测试 (K6)
└── 安全扫描 (Kube-bench/Popeye)

阶段 5 - 生产发布:
├── 蓝绿部署 / 金丝雀发布 (Flagger/Argo Rollouts)
├── 自动回滚 (基于错误率/延迟指标)
├── 监控验证 (SLO 检查)
└── 通知 (Slack/飞书)

工具链:
├── GitLab CI/GitHub Actions (CI)
├── ArgoCD (GitOps)
├── Prometheus + Grafana (监控)
├── Loki (日志)
├── Jaeger (追踪)
├── OPA Gatekeeper (策略)
└── Vault (密钥管理)
```

---

## 📝 面试总结

**50W 年薪 DevOps =**
- **基础扎实**：K8s 核心概念、资源对象、调度机制
- **架构能力**：多环境管理、高可用设计、成本优化
- **安全意识**：零信任架构、供应链安全、审计合规
- **自动化思维**：GitOps、CI/CD、基础设施即代码
- **故障排查**：网络诊断、性能分析、应急响应

**学习资源推荐**：
- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [CNCF 云原生全景图](https://landscape.cncf.io/)
- [K8s 安全最佳实践](https://kubernetes.io/docs/concepts/security/)
- [kubectl 备忘单](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

---

*最后更新: 2024-2025 | K8s 版本: 1.29+*