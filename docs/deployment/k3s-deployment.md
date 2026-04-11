# AgentHive Cloud - K3s 部署指南

**适用场景**: 阿里云 ECS 2 核 4G 内存及以上配置

---

## 📋 什么是 K3s？

K3s 是 Rancher 推出的轻量级 Kubernetes 发行版，特点：
- ✅ 单二进制文件，<500MB 内存占用
- ✅ 完整 K8s API 兼容
- ✅ 内置 Traefik Ingress
- ✅ 内置 StorageClass（SQLite/etcd）
- ✅ 适合边缘计算、资源受限场景

---

## 🚀 快速部署

### 1️⃣ 安装 K3s

```bash
# SSH 登录阿里云 ECS
ssh root@your-ecs-ip

# 一键安装 K3s
curl -sfL https://get.k3s.io | sh -

# 验证安装
kubectl get nodes
kubectl get pods -A
```

### 2️⃣ 配置 kubectl

```bash
# K3s 自动配置了 kubeconfig
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 添加到 ~/.bashrc 方便使用
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
source ~/.bashrc
```

### 3️⃣ 部署应用

```bash
# 1. 创建命名空间
kubectl create namespace agenthive

# 2. 部署应用
kubectl apply -k k8s/base -n agenthive

# 3. 查看部署状态
kubectl get all -n agenthive

# 4. 端口转发（测试用）
kubectl port-forward svc/landing -n agenthive 3000:3000
```

### 4️⃣ 配置 Ingress 访问

```yaml
# k8s/overlays/production/ingress-patch.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agenthive-ingress
  namespace: agenthive
  annotations:
    kubernetes.io/ingress.class: traefik
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
spec:
  tls:
    - hosts:
        - your-domain.com
      secretName: agenthive-tls
  rules:
    - host: your-domain.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 3001
          - path: /
            pathType: Prefix
            backend:
              service:
                name: landing
                port:
                  number: 3000
```

---

## 🔧 资源优化配置

### 调整副本数（2G 内存版）

```yaml
# k8s/overlays/lite/replica-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1  # 从 2 减为 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: landing
spec:
  replicas: 1  # 从 2 减为 1
```

### 调整资源限制

```yaml
# k8s/overlays/lite/resource-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: api
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: landing
spec:
  template:
    spec:
      containers:
        - name: landing
          resources:
            requests:
              cpu: "50m"
              memory: "128Mi"
            limits:
              cpu: "300m"
              memory: "384Mi"
```

---

## 📊 监控（可选）

### 轻量级监控方案

```bash
# 部署 metrics-server（K3s 内置）
kubectl top nodes
kubectl top pods -n agenthive

# 或使用 Prometheus Stack（需 1G+ 内存）
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

---

## 🔒 安全加固

### 1. 防火墙配置

```bash
# 阿里云安全组规则
# 必需：80 (HTTP), 443 (HTTPS), 22 (SSH)
# 可选：6443 (K3s API，仅内网访问)
```

### 2. 启用 HTTPS

```bash
# 使用 cert-manager 自动申请 Let's Encrypt 证书
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# 创建 ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
EOF
```

---

## 📈 资源监控

```bash
# 查看节点资源
kubectl top nodes

# 查看 Pod 资源
kubectl top pods -n agenthive

# 查看事件
kubectl get events -n agenthive --sort-by='.lastTimestamp'
```

---

## 🔄 更新部署

```bash
# 滚动更新
kubectl rollout restart deployment/api -n agenthive
kubectl rollout restart deployment/landing -n agenthive

# 查看更新状态
kubectl rollout status deployment/api -n agenthive

# 回滚（如有问题）
kubectl rollout undo deployment/api -n agenthive
```

---

## 💡 成本优化建议

### 1. 使用阿里云镜像加速器

```bash
# /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://registry.cn-hangzhou.aliyuncs.com"
  ]
}
```

### 2. 定时关闭（非生产环境）

```bash
# 每天 23:00 关闭，7:00 启动（节省费用）
# 阿里云控制台 → 运维与监控 → 定时任务

# 或使用 cron
# 关闭 K3s
0 23 * * * /bin/systemctl stop k3s

# 启动 K3s
0 7 * * * /bin/systemctl start k3s
```

### 3. 使用 Ollama 云端 API

本地部署 Ollama 需要 2-4GB 内存，建议使用云端 API：
- OpenAI API
- 通义千问 API
- DeepSeek API

---

## 📚 参考文档

- [K3s 官方文档](https://docs.k3s.io/)
- [阿里云 ECS 新手指南](https://help.aliyun.com/document_detail/25427.html)
- [K3s on Alibaba Cloud](https://rancher.com/docs/k3s/latest/en/installation/cloud-provider/)

---

**总结**: K3s 是低配 ECS 上运行 K8s 的最佳选择，内存占用仅为原生 K8s 的 1/4，
适合个人项目、开发测试环境、边缘计算场景。
