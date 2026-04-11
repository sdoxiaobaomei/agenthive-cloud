# AgentHive K8s 部署成本分析

> **目标**: 最低成本运行 + 面试展示场景优化

---

## 📊 基础架构需求

基于 RFC-001，需要部署以下组件：

```
┌─────────────────────────────────────────┐
│           AgentHive on EKS               │
├─────────────────────────────────────────┤
│                                          │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │   Landing   │  │       API       │   │
│  │  (Nuxt 3)   │  │   (Express)     │   │
│  │  200MB RAM  │  │   200MB RAM     │   │
│  └─────────────┘  └─────────────────┘   │
│        │                  │              │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Agent Runtime│  │   PostgreSQL    │   │
│  │  (Node.js)  │  │   ( StatefulSet)│   │
│  │  300MB RAM  │  │   200MB RAM     │   │
│  └─────────────┘  └─────────────────┘   │
│        │                  │              │
│  ┌─────────────┐                        │
│  │    Redis    │                        │
│  │   50MB RAM  │                        │
│  └─────────────┘                        │
│                                          │
│  总内存需求: ~1GB (运行态)                │
│  建议节点: 2vCPU 4GB RAM                 │
└─────────────────────────────────────────┘
```

---

## 💰 成本计算（AWS EKS 亚太地区）

### 1. 固定成本（无法节省）

| 项目 | 费用 | 说明 |
|------|------|------|
| **EKS 控制平面** | **$72/月** (~¥520) | 每个集群固定费用，即使0节点也要付 |
| **总计（固定）** | **$72/月** | 这是最低门槛 |

### 2. 可变成本（工作节点）

#### 方案 A: 最低配置（单节点 t3.medium）

| 项目 | 配置 | 单价 | 月费用 |
|------|------|------|--------|
| EC2 (On-Demand) | t3.medium (2vCPU 4GB) | $0.0416/小时 | ~$30 |
| EC2 (Spot) | t3.medium | $0.0125/小时 | ~$9 |
| EBS (根卷) | 20GB gp3 | $0.08/GB/月 | ~$1.6 |
| EBS (数据卷) | 50GB gp3 (PostgreSQL) | $0.08/GB/月 | ~$4 |

**方案 A 总计:**
- On-Demand: **$30 + $5.6 = ~$36/月**
- **Spot: $9 + $5.6 = ~$15/月** ⭐

#### 方案 B: 推荐配置（双节点 Spot）

| 项目 | 配置 | 月费用 |
|------|------|--------|
| EC2 (Spot) × 2 | t3.medium | ~$18 |
| EBS | 100GB | ~$8 |
| **总计** | | **~$26/月** |

**优势**: 高可用，节点故障不中断服务

### 3. 网络成本

| 项目 | 费用 | 说明 |
|------|------|------|
| ALB (应用负载均衡) | ~$20/月 + LCU | 必须，暴露服务 |
| NAT Gateway | ~$35/月 + 流量 | 私有子网出网需要 |
| 数据传输 | $0.09/GB | 入站免费，出站收费 |

**优化**: 使用 NLB ($17/月) 替代 ALB，或使用 Ingress-Nginx (只需 $10/月 NLB)

---

## 🎯 面试展示场景（按需开关）

### 核心问题
**EKS 控制平面 $72/月 = $2.4/天 是固定成本，无法关闭！**

但我们可以通过以下方式优化：

### 方案 1: 手动开关节点（推荐）

```bash
# 面试前10分钟启动
aws eks update-nodegroup-config \
  --cluster-name agenthive-demo \
  --nodegroup-name standard \
  --scaling-config minSize=1,maxSize=1,desiredSize=1

# 面试后关闭（缩容到0）
aws eks update-nodegroup-config \
  --cluster-name agenthive-demo \
  --nodegroup-name standard \
  --scaling-config minSize=0,maxSize=0,desiredSize=0
```

**成本计算:**

| 场景 | 计算 | 费用 |
|------|------|------|
| **关闭状态** | EKS 控制平面 + 0节点 | **$72/月 = $2.4/天** |
| **开启状态** | EKS + 1×t3.medium Spot | **$2.4 + $0.3/天 = $2.7/天** |
| **面试当天** (2小时) | $2.7/天 × (2/24) | **~$0.23** |

**月度估算 (每周面试1次，每次2小时):**
- 固定: $72
- 可变: $0.23 × 4 = ~$1
- **总计: ~$73/月 (~¥530)**

### 方案 2: 使用 Fargate（Serverless）

```yaml
# Fargate 配置 - 按秒计费，可以缩容到0
apiVersion: apps/v1
kind: Deployment
metadata:
  name: landing
spec:
  replicas: 0  # 默认0，需要时改为1
```

**成本:**
- Fargate vCPU: $0.04048/vCPU/小时
- Fargate Memory: $0.004445/GB/小时
- Landing (0.25vCPU, 0.5GB): ~$0.012/小时
- 面试2小时: ~$0.024

**优势**: 真正可以缩容到0，只付控制平面费

### 方案 3: 本地 Kind/K3s + 云端 EKS 仅展示

```bash
# 本地开发用 Kind（免费）
kind create cluster

# 面试时展示云上的 EKS（提前10分钟启动）
# 展示完立即关闭
```

**成本**: 只有那2小时的 $2.4/天 × (2/24) = **$0.2**

---

## 📈 详细成本对比表

| 方案 | 固定月费 | 面试2小时 | 月度总成本 | 可用性 |
|------|---------|-----------|-----------|--------|
| **纯 On-Demand** | $72 + $110 | $3.6 | ~$182 | 99.9% |
| **Spot 实例** | $72 + $26 | $2.7 | ~$98 | 95% |
| **按需开关 (推荐)** | $72 + $1 | $0.23 | **~$73** ⭐ | 手动 |
| **Fargate 按需** | $72 + $2 | $0.15 | ~$74 | 自动 |
| **仅展示用** | $0 | $0.2 | **~$0.2** ⭐⭐ | 手动 |

---

## 🛠️ 成本优化实操指南

### 1. 创建最小 EKS 集群

```bash
# 使用 eksctl 创建单节点 Spot 集群
eksctl create cluster \
  --name agenthive-demo \
  --region ap-southeast-1 \
  --node-type t3.medium \
  --nodes 0 \
  --nodes-min 0 \
  --nodes-max 1 \
  --node-volume-size 20 \
  --spot \
  --managed

# 成本: ~$72/月 (控制平面) + $0 (0节点)
```

### 2. 一键启停脚本

```bash
#!/bin/bash
# start-demo.sh - 面试前运行

echo "🚀 启动 AgentHive Demo 集群..."

# 扩容节点
eksctl scale nodegroup \
  --cluster agenthive-demo \
  --name standard \
  --nodes 1

# 等待节点就绪
kubectl wait --for=condition=ready node --all --timeout=300s

# 部署应用
kubectl apply -f k8s/

# 等待就绪
kubectl wait --for=condition=ready pod --all --timeout=300s

echo "✅ Demo 已就绪！访问: http://$(kubectl get svc ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
```

```bash
#!/bin/bash
# stop-demo.sh - 面试后运行

echo "🛑 关闭 AgentHive Demo 集群..."

# 缩容到0
eksctl scale nodegroup \
  --cluster agenthive-demo \
  --name standard \
  --nodes 0

echo "✅ 已缩容到0节点，仅保留控制平面 ($2.4/天)"
```

### 3. 使用 KEDA 自动缩容

```yaml
# scaledobject.yaml - 基于 HTTP 流量自动扩容
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: landing-scaler
spec:
  scaleTargetRef:
    name: landing
  minReplicaCount: 0
  maxReplicaCount: 1
  triggers:
  - type: prometheus
    metadata:
      serverAddress: http://prometheus:9090
      metricName: http_requests_total
      threshold: "1"
      query: sum(rate(http_requests_total{service="landing"}[2m]))
```

**效果**: 无流量时自动缩容到0 Pod，有请求时10秒内启动

---

## 💡 终极省钱方案（面试专用）

### 架构

```
本地开发 + 测试
    │
    │ (代码推送)
    ▼
GitHub Actions ──► 构建镜像 ──► 推送到 ECR
                                    │
                                    │ (面试前10分钟)
                                    ▼
                           临时启动 EKS 节点
                           部署应用
                           展示面试
                                    │
                                    │ (面试后5分钟)
                                    ▼
                           销毁节点
                           仅保留控制平面
```

### 成本明细

| 项目 | 面试前 | 面试中(2h) | 面试后 | 月费用 |
|------|--------|-----------|--------|--------|
| EKS 控制平面 | $72 | $72 | $72 | **$72** |
| EC2 Spot | $0 | $0.3 | $0 | ~$0.3 |
| EBS | $0 | $0.01 | $0 | ~$0.01 |
| **总计** | - | - | - | **~$72/月 (~¥520)** |

**按小时成本**: $72 ÷ 730 = **$0.098/小时 (~¥0.7/小时)**

**面试2小时成本**: $0.098 × 2 = **~$0.2 (¥1.4)**

---

## ⚠️ 重要提醒

### 1. EKS 控制平面无法关闭
- 即使 0 节点，也要付 $72/月
- 要完全关闭，只能 **删除集群**
- 删除后重建需要 10-15 分钟

### 2. Spot 实例风险
- 可能被回收（有2分钟通知）
- 面试前建议检查节点状态

### 3. 其他隐藏费用
- **ECR 存储**: $0.10/GB/月 (镜像存储)
- **CloudWatch 日志**: $0.50/GB (如果开启)
- **VPC 流量**: 跨 AZ 流量 $0.01/GB

### 4. 面试前检查清单
```bash
# 面试前30分钟运行
./start-demo.sh

# 验证
curl http://<ingress-ip>/health
kubectl get pods
kubectl top nodes
```

---

## 📋 总结

| 场景 | 推荐方案 | 月成本 | 面试2h成本 |
|------|---------|--------|-----------|
| **长期运行** | Spot + 2节点 | ~$100 | - |
| **面试展示** | 按需开关节点 | **~$73** | **~$0.23** |
| **极致省钱** | 本地 Kind + 云端仅展示 | ~$0 | **~$0.2** |

**推荐**: 如果只是面试展示，选择 **按需开关方案**，月成本约 **¥530**，面试2小时只需 **¥1.6**！
