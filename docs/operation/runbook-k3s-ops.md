# AgentHive Cloud — K3s 运维手册 (Runbook)

> **Ticket**: PLATFORM-010-D  
> **Scope**: 日常运维、故障排查、紧急操作  
> **Owner**: Platform Team

---

## 1. 常用命令速查

### 1.1 查看服务状态

```bash
# 所有 Pod
kubectl get pods -n agenthive

# 特定服务
kubectl get pods -n agenthive -l app.kubernetes.io/name=api

# 查看日志（实时）
kubectl logs -f deployment/api -n agenthive

# 查看日志（最近 100 行）
kubectl logs deployment/api -n agenthive --tail=100

# 多 Pod 日志（使用 stern）
stern -n agenthive api
```

### 1.2 查看资源使用

```bash
# Pod CPU/内存
kubectl top pod -n agenthive

# 节点资源
kubectl top node

# 描述 Pod（查看事件）
kubectl describe pod <pod-name> -n agenthive
```

### 1.3 Helm 操作

```bash
# 查看 release 状态
helm status agenthive -n agenthive

# 查看历史版本
helm history agenthive -n agenthive

# 回滚到上一版本
helm rollback agenthive -n agenthive

# 回滚到指定版本
helm rollback agenthive 3 -n agenthive

# 渲染模板（调试）
helm template agenthive chart/agenthive -f chart/agenthive/values.prod.yaml
```

---

## 2. 故障排查

### 2.1 Pod 处于 CrashLoopBackOff

```bash
# 1. 查看日志
kubectl logs <pod-name> -n agenthive --previous

# 2. 查看事件
kubectl describe pod <pod-name> -n agenthive | tail -20

# 3. 常见原因
# - 环境变量缺失（Secret 未创建）
# - 数据库连接失败（网络策略或 DB 未就绪）
# - 内存不足（OOMKilled）
```

### 2.2 Pod 处于 Pending

```bash
# 1. 查看事件
kubectl describe pod <pod-name> -n agenthive | grep -A 10 Events

# 2. 常见原因
# - 资源不足：节点 CPU/内存不够
# - PVC 未绑定：StorageClass 未配置
# - 镜像拉取失败：检查镜像名称和 registry 凭证
```

### 2.3 Ingress 无法访问

```bash
# 1. 检查 Ingress 状态
kubectl get ingress -n agenthive

# 2. 检查 ingress-nginx 控制器
kubectl get pods -n ingress-nginx

# 3. 检查证书
kubectl get certificates -n agenthive
kubectl describe certificate agenthive-tls -n agenthive

# 4. 测试内部连通性
kubectl run debug --rm -it --image=busybox:1.36 --restart=Never -n agenthive -- wget -O- http://api:3001/api/health
```

### 2.4 HPA 未触发

```bash
# 1. 查看 HPA 状态
kubectl get hpa -n agenthive
kubectl describe hpa api-hpa -n agenthive

# 2. 检查 metrics-server
kubectl top node

# 3. 手动压测触发
ab -n 10000 -c 100 https://api.agenthive.cloud/api/health
```

---

## 3. 紧急操作

### 3.1 服务完全不可用

```bash
# 1. 立即回滚
bash scripts/rollback-k3s.sh

# 2. 如果回滚失败，手动回滚
helm rollback agenthive -n agenthive

# 3. 验证
bash scripts/verify-deployment.sh
```

### 3.2 Secret 泄漏

```bash
# 1. 立即轮换
bash scripts/rotate-secrets.sh

# 2. 验证应用正常
kubectl get pods -n agenthive

# 3. 检查日志是否有异常
kubectl logs deployment/api -n agenthive --tail=50
```

### 3.3 节点宕机

```bash
# K3s 是单节点，节点宕机 = 全服务不可用
# 1. 检查 ECS 状态（阿里云控制台）
# 2. SSH 到 ECS 检查 K3s
sudo systemctl status k3s

# 3. 重启 K3s
sudo systemctl restart k3s

# 4. 验证
bash scripts/verify-k3s.sh
```

---

## 4. 扩展操作

### 4.1 手动扩容

```bash
# 临时扩容 API 到 5 个副本
kubectl scale deployment api --replicas=5 -n agenthive

# 恢复
kubectl scale deployment api --replicas=3 -n agenthive
```

### 4.2 进入 Pod 调试

```bash
# API Pod
kubectl exec -it deployment/api -n agenthive -- sh

# 带环境变量调试
kubectl run debug --rm -it --image=busybox:1.36 --restart=Never -n agenthive --env="DB_HOST=postgres" -- sh
```

### 4.3 导出日志

```bash
# 导出所有 Pod 日志
for pod in $(kubectl get pods -n agenthive -o jsonpath='{.items[*].metadata.name}'); do
  kubectl logs "$pod" -n agenthive > "/tmp/${pod}.log" 2>&1
done
```

---

## 5. 监控面板

| 工具 | URL | 用途 |
|------|-----|------|
| Grafana | https://grafana.agenthive.cloud | 指标、日志、追踪 |
| Prometheus | http://prometheus.monitoring.svc.cluster.local:9090 | 指标查询 |
| Loki | http://loki.monitoring.svc.cluster.local:3100 | 日志查询 |
| Tempo | http://tempo.monitoring.svc.cluster.local:3200 | 分布式追踪 |

---

## 6. 联系人

| 角色 | 姓名 | 联系方式 |
|------|------|---------|
| Platform Lead | 待定 | Slack #platform |
| On-Call | 待定 | PagerDuty |
| 阿里云支持 | - | 工单系统 |
