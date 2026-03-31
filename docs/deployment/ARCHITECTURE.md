# 部署架构设计

**平台**: Kubernetes (Kind/Minikube/EKS/ACK)  
**部署工具**: Helm + Skaffold  
**日期**: 2026-03-31

---

## 1. 部署架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Namespace: agenthive-dev                                  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                    Ingress                           │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐                   │  │  │
│  │  │  │  Web UI     │  │  API GW     │                   │  │  │
│  │  │  │  (80/443)   │  │  (8080)     │                   │  │  │
│  │  │  └──────┬──────┘  └──────┬──────┘                   │  │  │
│  │  └─────────┼────────────────┼───────────────────────────┘  │  │
│  │            │                │                              │  │
│  │  ┌─────────▼────────────────▼───────────┐                  │  │
│  │  │       Services                        │                  │  │
│  │  │  ┌──────────────────────────┐        │                  │  │
│  │  │  │   web-service            │        │                  │  │
│  │  │  │   Type: ClusterIP        │        │                  │  │
│  │  │  │   Port: 80               │        │                  │  │
│  │  │  └──────────────────────────┘        │                  │  │
│  │  │  ┌──────────────────────────┐        │                  │  │
│  │  │  │   supervisor-service     │        │                  │  │
│  │  │  │   Type: ClusterIP        │        │                  │  │
│  │  │  │   Port: 8080             │        │                  │  │
│  │  │  └──────────────────────────┘        │                  │  │
│  │  └──────────────────────────────────────┘                  │  │
│  │            │                │                              │  │
│  │  ┌─────────▼────────────────▼───────────┐                  │  │
│  │  │       Deployments                     │                  │  │
│  │  │                                       │                  │  │
│  │  │  ┌──────────────────────────────┐    │                  │  │
│  │  │  │   web-deployment             │    │                  │  │
│  │  │  │   Replicas: 2                │    │                  │  │
│  │  │  │   Image: agenthive/web       │    │                  │  │
│  │  │  │   Resources:                 │    │                  │  │
│  │  │  │     CPU: 100m/500m           │    │                  │  │
│  │  │  │     Memory: 128Mi/512Mi      │    │                  │  │
│  │  │  └──────────────────────────────┘    │                  │  │
│  │  │                                       │                  │  │
│  │  │  ┌──────────────────────────────┐    │                  │  │
│  │  │  │   supervisor-deployment      │    │                  │  │
│  │  │  │   Replicas: 2                │    │                  │  │
│  │  │  │   Image: agenthive/supervisor│    │                  │  │
│  │  │  │   Resources:                 │    │                  │  │
│  │  │  │     CPU: 250m/1000m          │    │                  │  │
│  │  │  │     Memory: 256Mi/1Gi        │    │                  │  │
│  │  │  └──────────────────────────────┘    │                  │  │
│  │  │                                       │                  │  │
│  │  │  ┌──────────────────────────────┐    │                  │  │
│  │  │  │   agent-runtime (StatefulSet)│    │                  │  │
│  │  │  │   Replicas: 3                │    │                  │  │
│  │  │  │   Image: agenthive/agent     │    │                  │  │
│  │  │  │   Resources:                 │    │                  │  │
│  │  │  │     CPU: 500m/2000m          │    │                  │  │
│  │  │  │     Memory: 512Mi/2Gi        │    │                  │  │
│  │  │  │   Volume: 10Gi workspace     │    │                  │  │
│  │  │  └──────────────────────────────┘    │                  │  │
│  │  └──────────────────────────────────────┘                  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Stateful Services                       │  │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │  │
│  │  │  │   Redis    │  │ PostgreSQL │  │   MinIO    │    │  │  │
│  │  │  │   (HA)     │  │  (Primary) │  │  (Cluster) │    │  │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 资源配额

### 2.1 开发环境

| 组件 | 副本 | CPU Request | CPU Limit | Memory Request | Memory Limit |
|------|------|-------------|-----------|----------------|--------------|
| Web UI | 1 | 100m | 500m | 128Mi | 512Mi |
| Supervisor | 1 | 250m | 1000m | 256Mi | 1Gi |
| Agent Runtime | 3 | 500m | 2000m | 512Mi | 2Gi |
| Redis | 1 | 100m | 500m | 256Mi | 512Mi |
| PostgreSQL | 1 | 250m | 1000m | 512Mi | 1Gi |
| **总计** | - | **2.2核** | **9核** | **2.2GB** | **8GB** |

### 2.2 生产环境

| 组件 | 副本 | CPU Request | CPU Limit | Memory Request | Memory Limit |
|------|------|-------------|-----------|----------------|--------------|
| Web UI | 3 | 100m | 500m | 128Mi | 512Mi |
| Supervisor | 3 | 250m | 1000m | 256Mi | 1Gi |
| Agent Runtime | 10 | 500m | 2000m | 512Mi | 2Gi |
| Redis | 3 | 200m | 1000m | 512Mi | 1Gi |
| PostgreSQL | 2 | 500m | 2000m | 1Gi | 2Gi |
| **总计** | - | **8.4核** | **30核** | **9.4GB** | **28GB** |

---

## 3. 网络配置

### 3.1 Service定义

```yaml
# web-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: agenthive-web
  namespace: agenthive-dev
spec:
  selector:
    app.kubernetes.io/name: agenthive-web
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
  type: ClusterIP

---
# supervisor-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: agenthive-supervisor
  namespace: agenthive-dev
spec:
  selector:
    app.kubernetes.io/name: agenthive-supervisor
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
  type: ClusterIP
```

### 3.2 Ingress配置

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agenthive-ingress
  namespace: agenthive-dev
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
spec:
  ingressClassName: nginx
  rules:
    - host: agenthive.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: agenthive-web
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: agenthive-supervisor
                port:
                  number: 8080
          - path: /ws
            pathType: Prefix
            backend:
              service:
                name: agenthive-supervisor
                port:
                  number: 8080
```

---

## 4. 存储配置

### 4.1 PersistentVolumeClaims

```yaml
# agent-workspace-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: agent-workspace
  namespace: agenthive-dev
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard  # 根据环境调整

---
# postgres-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: agenthive-dev
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi

---
# minio-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-data
  namespace: agenthive-dev
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

---

## 5. 安全配置

### 5.1 RBAC

```yaml
# service-account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: agenthive-supervisor
  namespace: agenthive-dev

---
# role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: agenthive-supervisor
  namespace: agenthive-dev
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

---
# role-binding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: agenthive-supervisor
  namespace: agenthive-dev
subjects:
  - kind: ServiceAccount
    name: agenthive-supervisor
    namespace: agenthive-dev
roleRef:
  kind: Role
  name: agenthive-supervisor
  apiGroup: rbac.authorization.k8s.io
```

### 5.2 NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agenthive-default
  namespace: agenthive-dev
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 允许Ingress访问Web
    - from:
        - namespaceSelector:
            matchLabels:
              ingress: "true"
      ports:
        - protocol: TCP
          port: 80
    # 允许内部通信
    - from:
        - namespaceSelector:
            matchLabels:
              name: agenthive-dev
  egress:
    # 允许访问外部（LLM API等）
    - {}
```

---

## 6. 自动扩展

### 6.1 HPA配置

```yaml
# agent-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-runtime
  namespace: agenthive-dev
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: StatefulSet
    name: agent-runtime
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: External
      external:
        metric:
          name: agenthive_task_queue_depth
          selector:
            matchLabels:
              metricType: avg
        target:
          type: AverageValue
          averageValue: "5"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### 6.2 VPA配置（可选）

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: agent-runtime
  namespace: agenthive-dev
spec:
  targetRef:
    apiVersion: apps/v1
    kind: StatefulSet
    name: agent-runtime
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: agent
        minAllowed:
          cpu: 250m
          memory: 256Mi
        maxAllowed:
          cpu: 4000m
          memory: 4Gi
```

---

## 7. 监控配置

### 7.1 ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: agenthive-metrics
  namespace: agenthive-dev
spec:
  selector:
    matchLabels:
      app.kubernetes.io/part-of: agenthive
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
```

### 7.2 PrometheusRule

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: agenthive-alerts
  namespace: agenthive-dev
spec:
  groups:
    - name: agenthive
      rules:
        - alert: AgentDown
          expr: |
            time() - agenthive_agent_last_heartbeat > 120
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Agent {{ $labels.agent_id }} is down"
        
        - alert: HighTaskQueue
          expr: |
            agenthive_task_queue_depth > 20
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High task queue depth: {{ $value }}"
```

---

## 8. 环境特定配置

### 8.1 本地开发 (Kind)

```yaml
# values-kind.yaml
ingress:
  enabled: false  # 使用NodePort

services:
  web:
    type: NodePort
    nodePort: 30080
  supervisor:
    type: NodePort
    nodePort: 30081

resources:
  limits:
    cpu: 2000m
    memory: 4Gi
```

### 8.2 生产环境 (EKS)

```yaml
# values-production.yaml
ingress:
  enabled: true
  className: alb
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip

services:
  web:
    type: ClusterIP
  supervisor:
    type: ClusterIP

resources:
  limits:
    cpu: 4000m
    memory: 8Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
```

---

## 9. 部署流程

### 9.1 首次部署

```bash
# 1. 创建命名空间
kubectl create namespace agenthive-dev

# 2. 安装依赖服务
helm upgrade --install redis bitnami/redis -n agenthive-dev
helm upgrade --install postgres bitnami/postgresql -n agenthive-dev
helm upgrade --install minio bitnami/minio -n agenthive-dev

# 3. 部署AgentHive
helm upgrade --install agenthive ./deploy/helm/agenthive \
  -n agenthive-dev \
  -f ./deploy/helm/agenthive/values-dev.yaml

# 4. 检查状态
kubectl get pods -n agenthive-dev
kubectl get svc -n agenthive-dev
kubectl get ingress -n agenthive-dev
```

### 9.2 更新部署

```bash
# 方式1: Helm升级
helm upgrade agenthive ./deploy/helm/agenthive -n agenthive-dev

# 方式2: Skaffold热重载 (开发)
skaffold dev -f deploy/skaffold.yaml
```

### 9.3 回滚

```bash
# 查看历史
helm history agenthive -n agenthive-dev

# 回滚到上一版本
helm rollback agenthive -n agenthive-dev

# 回滚到指定版本
helm rollback agenthive 3 -n agenthive-dev
```

---

## 10. 故障排查

### 10.1 常用命令

```bash
# 查看Pod状态
kubectl get pods -n agenthive-dev -o wide

# 查看日志
kubectl logs -n agenthive-dev -l app.kubernetes.io/name=agenthive-supervisor --tail=100 -f

# 进入Pod调试
kubectl exec -it -n agenthive-dev agenthive-supervisor-xxx -- /bin/sh

# 查看资源使用
kubectl top pod -n agenthive-dev

# 查看事件
kubectl get events -n agenthive-dev --sort-by='.lastTimestamp'
```

### 10.2 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Pod Pending | 资源不足 | 调整requests或扩容节点 |
| CrashLoopBackOff | 应用错误 | 查看日志，修复代码 |
| ImagePullBackOff | 镜像不存在 | 检查镜像tag，重新构建 |
| Connection refused | 服务未就绪 | 检查 readinessProbe |

---

**部署架构设计完成！**
