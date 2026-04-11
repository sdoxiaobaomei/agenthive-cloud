# 🔥 AWS 高频面试题 50 问（2026 版）

> 涵盖 Amazon Bedrock、EKS Auto Mode、S3 Express One Zone、Aurora Limitless、Lambda SnapStart 等 2024-2026 最新技术栈

---

## 📑 目录

- [一、基础服务篇（10题）](#一基础服务篇10题)
- [二、容器与 Serverless 篇（10题）](#二容器与-serverless-篇10题)
- [三、AI/ML 与生成式 AI 篇（10题）](#三aiml-与生成式-ai-篇10题)
- [四、数据库与存储篇（10题）](#四数据库与存储篇10题)
- [五、安全、运维与成本优化篇（10题）](#五安全运维与成本优化篇10题)

---

## 一、基础服务篇（10题）

### Q1: AWS Graviton4 相比 x86 和 Graviton3 有什么优势？什么场景推荐使用？

**A:**

| 特性 | x86 (Intel/AMD) | Graviton3 | Graviton4 |
|------|-----------------|-----------|-----------|
| **性能** | 基准 | +25% | +30% vs G3 |
| **性价比** | 1x | 40%更好 | 50%更好 |
| **内存带宽** | 标准 | 高 | +75% |
| **安全** | 标准 | DDR5加密 | 全内存加密 |
| **AI/ML推理** | 需GPU | 基础支持 | 增强向量指令 |

**推荐场景**：
- Web服务器、微服务（性价比最高）
- 容器化工作负载（ECS/EKS on Graviton）
- 开源数据库（MySQL/PostgreSQL/Redis）
- 视频编码、压缩计算

**迁移注意**：
```dockerfile
# 多架构镜像构建
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
...
FROM node:20-alpine
# 自动适配 Graviton 或 x86
```

---

### Q2: S3 Express One Zone 是什么？与标准 S3 和 S3 Standard-IA 的区别？

**A:**

| 存储类型 | 延迟 | 可用性 | 使用场景 |
|----------|------|--------|----------|
| **S3 Standard** | 毫秒级 | 99.99% | 通用存储 |
| **S3 Express One Zone** | 个位数毫秒 | 99.95% | 高性能分析/ML训练 |
| **S3 Standard-IA** | 毫秒级 | 99.9% | 低频访问 |

**核心特性**：
- 单可用区设计（降低延迟）
- 目录桶（Directory Buckets）- 每秒数百万 TPS
- 与计算同一可用区（EC2/ECS/EKS）
- 10x 访问速度提升，50% 成本降低（高频访问时）

**使用场景**：
- Apache Spark 分析
- ML 训练数据集
- 实时广告竞价

```python
import boto3

# 创建 S3 Express 目录桶
s3 = boto3.client('s3')
s3.create_bucket(
    Bucket='my-express-bucket--use1-az4',  # 必须包含 AZ 后缀
    CreateBucketConfiguration={
        'LocationConstraint': 'us-east-1',
        'Type': 'Directory'  # 关键参数
    }
)
```

---

### Q3: VPC Lattice 是什么？与 API Gateway、ALB、Service Mesh 的区别？

**A:**

**VPC Lattice** = 应用层网络服务，简化服务间通信

| 特性 | API Gateway | ALB | VPC Lattice | Service Mesh (Istio) |
|------|-------------|-----|-------------|---------------------|
| **层级** | API层 | L4/L7 | 应用层 | L4/L7 |
| **跨VPC** | 需PrivateLink | 需TGW | 原生支持 | 需配置 |
| **服务发现** | 手动 | DNS | 自动 | 自动 |
| **mTLS** | 支持 | 不支持 | 自动 | 支持 |
| **复杂度** | 中 | 低 | 极低 | 高 |

**核心能力**：
- 自动服务发现（无需 DNS/负载均衡器）
- 内置身份验证（IAM/Cognito）
- 流量管理（金丝雀、蓝绿）
- 跨账户/跨VPC无缝通信

```yaml
# VPC Lattice 服务网络
ServiceNetwork:
  Name: production-services
  AuthType: AWS_IAM
Services:
  - Name: order-service
    TargetGroup:
      Port: 8080
      Protocol: HTTP
      HealthCheck:
        Path: /health
```

---

### Q4: IAM Roles Anywhere 解决了什么问题？与 STS AssumeRole 的区别？

**A:**

**解决的问题**：
- 本地数据中心服务器需要访问 AWS 资源
- 无需创建长期 IAM User（安全最佳实践）

**架构**：
```
本地服务器 → IAM Roles Anywhere → 临时凭证 → AWS 服务
       ↑
   私有 CA/ACM PCA
```

**与 STS AssumeRole 对比**：

| 特性 | STS AssumeRole | IAM Roles Anywhere |
|------|----------------|-------------------|
| **身份来源** | AWS 账户/OIDC/SAML | X.509 证书 |
| **使用场景** | AWS 内/跨账户 | 本地/多云/边缘 |
| **凭证有效期** | 1-12小时 | 1-12小时 |
| **基础设施** | AWS 托管 | 需私有 CA |

**使用步骤**：
1. 创建 Trust Anchor（关联私有 CA）
2. 配置 IAM Role + Trust Policy
3. 本地安装 `aws_signing_helper`
4. 获取临时凭证

```bash
# 本地服务器获取凭证
./aws_signing_helper credential-process \
  --certificate /path/to/cert.pem \
  --private-key /path/to/key.pem \
  --trust-anchor-arn arn:aws:rolesanywhere:... \
  --profile-arn arn:aws:rolesanywhere:... \
  --role-arn arn:aws:iam::123456789012:role/OnPremRole
```

---

### Q5: AWS Nitro Enclaves 是什么？什么场景使用？

**A:**

**核心概念**：
- EC2 实例内部的隔离计算环境
- 独立的 CPU 和内存，无网络连接
- 通过 vsock 与父实例通信

**使用场景**：
- **机密计算**：处理敏感数据（PII/金融数据）
- **密钥保护**：与 AWS KMS 集成，密钥永不出 enclave
- **多方计算**：敏感数据分析

**工作流程**：
```python
# 1. 创建 Enclave-enabled EC2（需特定实例类型）
# 2. 构建 Enclave 镜像（EIF 格式）
# 3. 启动 Enclave
import boto3

ec2 = boto3.client('ec2')
response = ec2.run_instances(
    ImageId='ami-xxxx',
    InstanceType='m5.2xlarge',
    EnclaveOptions={'Enabled': True}
)

# 4. 在实例内启动 Enclave
nitro-cli run-enclave \
  --cpu-count 2 \
  --memory 512 \
  --eif-path app.eif
```

---

### Q6: AWS PrivateLink vs VPC Peering vs Transit Gateway 如何选择？

**A:**

**决策树**：

```
是否跨账户/跨Region？
├── 是 → 是否需要集中管控？
│       ├── 是 → Transit Gateway
│       └── 否 → VPC Peering
└── 否 → 是否访问 AWS 服务/SaaS？
        ├── 是 → PrivateLink
        └── 否 → VPC Peering
```

**详细对比**：

| 特性 | VPC Peering | Transit Gateway | PrivateLink |
|------|-------------|-----------------|-------------|
| **规模** | 最大125对等 | 数千 VPC | 无限制 |
| **跨Region** | 支持 | 支持 | 支持 |
| **费用** | $0.01/GB | $0.05/TGW-hour + 数据传输 | $0.01/hour + $0.01/GB |
| **安全性** | 双向开放 | 可路由控制 | 单向服务暴露 |
| **使用场景** | 两个VPC | 企业网络中心 | 服务发布/消费 |

**PrivateLink 优势**：
- 服务提供者不暴露整个 VPC
- 消费者通过 VPC Endpoint 访问
- 支持 AWS 服务和第三方 SaaS

---

### Q7: EC2 Auto Scaling Group 的 Warm Pools、Mixed Instances Policy 是什么？

**A:**

**Warm Pools（预热池）**：
- 提前创建实例并处于 "Warm" 状态
- 缩容时实例回到 Warm Pool 而非终止
- 再次扩容时秒级启动

```json
{
  "WarmPoolConfiguration": {
    "PoolState": "Hibernated",  // 或 Running/Stopped
    "MinSize": 2,
    "MaxSize": 10
  }
}
```

**Mixed Instances Policy（混合实例策略）**：
- 自动选择最优价格/容量的实例类型
- 结合 Spot + On-Demand
- 分配策略：lowest-price / capacity-optimized / price-capacity-optimized

```json
{
  "MixedInstancesPolicy": {
    "LaunchTemplate": {
      "LaunchTemplateSpecification": {...}
    },
    "Overrides": [
      {"InstanceType": "m6g.large", "WeightedCapacity": "1"},
      {"InstanceType": "m5.large", "WeightedCapacity": "1"},
      {"InstanceType": "m5a.large", "WeightedCapacity": "1"}
    ],
    "InstancesDistribution": {
      "OnDemandAllocationStrategy": "prioritized",
      "OnDemandBaseCapacity": 2,
      "OnDemandPercentageAboveBaseCapacity": 50,
      "SpotAllocationStrategy": "price-capacity-optimized"
    }
  }
}
```

---

### Q8: AWS Systems Manager (SSM) Session Manager 的优势？与 SSH 的区别？

**A:**

**对比**：

| 特性 | SSH | Session Manager |
|------|-----|-----------------|
| **端口** | 22 | 443 (HTTPS) |
| **安全组** | 需开放 22 | 无需入站规则 |
| **密钥管理** | 管理 PEM 密钥 | IAM 认证 |
| **审计** | 需额外配置 | 自动记录到 S3/CloudWatch |
| **端口转发** | 原生支持 | 支持 |
| **成本** | $0 | $0 |

**核心优势**：
1. 无管理密钥（零信任）
2. 无需开放端口（最小权限）
3. 完整审计日志（合规要求）
4. 支持标签级权限控制

**使用**：
```bash
# 无需 SSH 密钥
aws ssm start-session --target i-0123456789abcdef0

# 端口转发
aws ssm start-session \
  --target i-0123456789abcdef0 \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["3306"], "localPortNumber":["3306"]}'
```

---

### Q9: AWS Organizations 的 SCP (Service Control Policy) 最佳实践？

**A:**

**SCP 策略层次**：
```
Root
├── SCP: 全组织基线策略
├── OU: Production
│   └── SCP: 禁止删除 CloudTrail
├── OU: Development
│   └── SCP: 限制实例类型为 t3.*
└── OU: Sandbox
    └── SCP:  deny 所有高风险操作
```

**最佳实践**：

1. **默认拒绝，显式允许**：
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyHighRiskRegions",
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "StringEquals": {
        "aws:RequestedRegion": ["ap-east-1", "me-south-1"]
      }
    }
  }]
}
```

2. **保护安全服务**：
```json
{
  "Statement": [{
    "Effect": "Deny",
    "Action": [
      "cloudtrail:DeleteTrail",
      "cloudtrail:StopLogging",
      "config:DeleteConfigRule"
    ],
    "Resource": "*"
  }]
}
```

3. **限制实例类型**（成本控制）：
```json
{
  "Statement": [{
    "Effect": "Deny",
    "Action": "ec2:RunInstances",
    "Resource": "arn:aws:ec2:*:*:instance/*",
    "Condition": {
      "ForAllValues:StringNotLike": {
        "ec2:InstanceType": ["t3.*", "m6g.*", "c6g.*"]
      }
    }
  }]
}
```

---

### Q10: AWS CloudFront 的 Origin Shield、Function@Edge 与 Lambda@Edge 区别？

**A:**

| 特性 | Function@Edge | Lambda@Edge | Origin Shield |
|------|---------------|-------------|---------------|
| **运行时** | CloudFront 原生 | Node.js/Python | 缓存层 |
| **延迟** | <1ms | 10-100ms | - |
| **功能** | 简单请求/响应修改 | 复杂计算 | 减少回源 |
| **成本** | 低 | 较高 | 中等 |
| **场景** | URL重写、Header操作 | A/B测试、认证 | 全局源站保护 |

**Function@Edge 示例**：
```javascript
// 重写 URL
function handler(event) {
    var request = event.request;
    request.uri = request.uri.replace(/^\/old-path/, '/new-path');
    return request;
}
```

**Origin Shield 架构**：
```
用户 → CloudFront PoP → Origin Shield (单一区域) → 源站
              ↑___________________↓
              跨区域的缓存共享
```

**使用场景**：
- 动态内容加速（减少源站负载）
- 全局一致性缓存

---

## 二、容器与 Serverless 篇（10题）

### Q11: Amazon EKS Auto Mode 是什么？与 EKS Managed Node Groups、Fargate 的区别？

**A:**

**EKS Auto Mode（2024新特性）**：
- AWS 全自动管理节点生命周期
- 自动选择最优实例类型（包括 Graviton）
- 自动扩缩容（Karpenter 内置）
- 自动安全补丁和更新

**对比**：

| 特性 | Self-Managed | Managed Node Groups | Fargate | Auto Mode |
|------|-------------|---------------------|---------|-----------|
| **节点管理** | 用户全责 | AWS 管理节点 | 无服务器 | AWS 全自动 |
| **实例选择** | 用户指定 | 用户指定 | N/A | AWS 自动优化 |
| **扩缩容** | 需配置 CAS | 需配置 CAS | 自动 Pod级 | 自动节点级 |
| **成本优化** | 用户负责 | 用户负责 | 按 vCPU/内存 | 自动 Spot混合 |
| **适用场景** | 特殊需求 | 标准工作负载 | 突发/批处理 | 通用最佳 |

**启用 Auto Mode**：
```bash
aws eks create-cluster \
  --name my-cluster \
  --auto-mode-enabled \
  --kubernetes-version 1.31
```

**节点池配置**：
```yaml
apiVersion: eks.amazonaws.com/v1
kind: NodePool
metadata:
  name: general-purpose
spec:
  requirements:
    - key: kubernetes.io/arch
      operator: In
      values: ["amd64", "arm64"]
    - key: eks.amazonaws.com/capacity-type
      operator: In
      values: ["spot", "on-demand"]
```

---

### Q12: ECS Fargate 的 Spot 容量提供商如何配置？有什么注意事项？

**A:**

**配置**：
```json
{
  "capacityProviders": ["FARGATE", "FARGATE_SPOT"],
  "defaultCapacityProviderStrategy": [
    {
      "base": 1,
      "weight": 1,
      "capacityProvider": "FARGATE"
    },
    {
      "weight": 3,
      "capacityProvider": "FARGATE_SPOT"
    }
  ]
}
```

**策略解释**：
- 基础 1 个任务用 Fargate
- 后续 1:3 比例分配（25% On-Demand, 75% Spot）

**注意事项**：

1. **Spot 中断处理**：
```python
# 在任务中监听 SIGTERM
import signal
import sys

def handler(signum, frame):
    print('Spot interruption received, saving state...')
    # 保存检查点
    sys.exit(0)

signal.signal(signal.SIGTERM, handler)
```

2. **任务定义设置**：
```json
{
  "stopTimeout": 120,
  "essential": true
}
```

3. **不适用场景**：
- 长时间运行任务（>1小时建议用 EC2 Spot）
- 不可中断的关键服务

---

### Q13: Lambda SnapStart 是什么？与 Provisioned Concurrency 的区别？

**A:**

**Lambda 冷启动优化对比**：

| 方案 | 启动延迟 | 成本 | 工作原理 |
|------|----------|------|----------|
| **标准 Lambda** | 100ms-10s | 最低 | 从头初始化 |
| **SnapStart** | <1s | 免费 | 发布时创建快照 |
| **Provisioned Concurrency** | 毫秒级 | 高 | 保持预热实例 |

**SnapStart 原理**：
```
发布版本 → 初始化运行时 → 创建 Firecracker 快照 → 存储在 S3
调用请求 → 恢复快照 → 从快照点后执行
```

**支持的运行时**：Java 11/17/21（Spring Boot 优化明显）

**使用**：
```java
// 需要 Lambda 优化层
// 1. 开启 SnapStart
aws lambda update-function-configuration \
  --function-name my-function \
  --snap-start ApplyOn=PublishedVersions

// 2. 发布版本（触发快照创建）
aws lambda publish-version --function-name my-function
```

**最佳实践**：
- 延迟敏感 + 低并发 → SnapStart
- 延迟敏感 + 高并发 → Provisioned Concurrency
- 成本优先 → 标准 Lambda

---

### Q14: AWS App Runner vs ECS Fargate vs EKS 如何选择？

**A:**

**决策矩阵**：

| 特性 | App Runner | ECS Fargate | EKS |
|------|-----------|-------------|-----|
| **复杂度** | 极低 | 中 | 高 |
| **控制粒度** | 低 | 中 | 极高 |
| **自动扩缩容** | 内置 | 需配置 | 需配置 |
| **网络控制** | 有限 | VPC完整 | VPC完整 |
| **服务网格** | 不支持 | 需集成 | 原生/插件 |
| **CI/CD** | 内置连接GitHub | 需CodePipeline | 需Flux/ArgoCD |

**选择建议**：

- **App Runner**：
  - Web 应用/API 快速上线
  - 不需要复杂网络配置
  - 从源代码或容器镜像直接部署

- **ECS Fargate**：
  - 需要 VPC 网络控制
  - 微服务架构
  - 任务定义复杂依赖

- **EKS**：
  - Kubernetes 原生需求
  - 多租户/复杂调度
  - 需要 Service Mesh

**App Runner 示例**：
```bash
aws apprunner create-service \
  --service-name my-web-app \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest",
      "ImageConfiguration": {"Port": "8080"},
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": true
  }'
```

---

### Q15: EKS Pod Identity 是什么？与 IRSA (IAM Roles for Service Account) 的区别？

**A:**

**EKS Pod Identity（2023 新特性）**：
- 无需 OIDC Provider 配置
- 通过 EKS Auth API 直接关联 IAM Role 和 Service Account
- 支持同一 Namespace 不同 Pod 使用不同 Role

**对比**：

| 特性 | IRSA (传统) | EKS Pod Identity |
|------|-------------|------------------|
| **配置复杂度** | 高（需OIDC） | 低（EKS托管） |
| **信任策略** | 需配置 OIDC URL | 自动管理 |
| **Session Tag** | 不支持 | 支持 |
| **多集群** | 每集群独立配置 | 简化配置 |

**Pod Identity 使用**：

1. 创建 IAM Role（信任 EKS Pod Identity）
2. EKS 集群添加 Pod Identity Agent
3. 创建关联：

```bash
aws eks create-pod-identity-association \
  --cluster-name my-cluster \
  --namespace production \
  --service-account api-service \
  --role-arn arn:aws:iam::123456789012:role/EKSPodRole
```

**Pod 使用**：
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-service
  namespace: production
  # 无需 annotations!
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      serviceAccountName: api-service
      containers:
      - name: app
        image: my-app:latest
        # 自动获得 IAM 凭证
```

---

### Q16: Lambda 函数 URL 与 API Gateway 的区别？什么时候用函数 URL？

**A:**

| 特性 | Function URL | API Gateway (HTTP API) | API Gateway (REST API) |
|------|-------------|----------------------|---------------------|
| **延迟** | 低 | 中 | 高 |
| **功能** | 基础 | 路由/限流/JWT | 完整功能 |
| **费用** | $0（只付Lambda） | $1-10/百万请求 | $3.5/百万请求 |
| **CORS** | 内置 | 需配置 | 需配置 |
| **WAF** | 不支持 | 支持 | 支持 |

**函数 URL 适用场景**：
- 单一端点微服务
- Webhook 接收器
- 内部服务通信
- 简单代理

**启用函数 URL**：
```bash
aws lambda create-function-url-config \
  --function-name my-function \
  --auth-type AWS_IAM  # 或 NONE
  --cors-config '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["GET", "POST"],
    "AllowHeaders": ["content-type"]
  }'
```

**最佳实践**：
- 需要路由/限流/缓存 → API Gateway
- 简单端点/成本敏感 → Function URL

---

### Q17: Amazon ECR 的 Pull-Through Cache 和 Replication 是什么？

**A:**

**Pull-Through Cache（拉取缓存）**：
- 缓存 Docker Hub/Quay 等公共镜像
- 避免 Docker Hub 速率限制
- 在 VPC 内访问（无需公网）

```bash
# 创建拉取缓存规则
aws ecr create-pull-through-cache-rule \
  --ecr-repository-prefix docker-hub \
  --upstream-registry-url registry-1.docker.io \
  --registry-id 123456789012

# 使用缓存拉取
# 原: docker pull nginx:latest
# 现: docker pull 123456789012.dkr.ecr.us-east-1.amazonaws.com/docker-hub/library/nginx:latest
```

**Replication（复制）**：
- 跨区域自动复制镜像
- 就近拉取降低延迟
- 灾难恢复

```json
{
  "replicationConfiguration": {
    "rules": [{
      "destinations": [
        {"region": "eu-west-1", "registryId": "123456789012"},
        {"region": "ap-southeast-1", "registryId": "123456789012"}
      ]
    }]
  }
}
```

---

### Q18: ECS Service Connect 是什么？与 Service Discovery 的区别？

**A:**

**ECS Service Connect**：
- 托管的服务网格（简化版）
- 自动负载均衡
- 内置 mTLS
- 流量指标（CloudWatch）

**对比**：

| 特性 | Service Discovery | Service Connect | App Mesh |
|------|------------------|-----------------|----------|
| **服务发现** | DNS 基础 | 原生 | Envoy |
| **负载均衡** | 客户端 | 自动 | Envoy |
| **mTLS** | 无 | 自动 | 配置 |
| **可观测性** | 无 | CloudWatch | X-Ray |
| **复杂度** | 低 | 极低 | 高 |

**配置示例**：
```json
{
  "serviceConnectConfiguration": {
    "enabled": true,
    "namespace": "production.local",
    "services": [{
      "portName": "http",
      "discoveryName": "order-service",
      "clientAliases": [{"port": 8080}]
    }]
  }
}
```

**客户端调用**：
```python
# 通过服务名直接访问
import requests
response = requests.get('http://order-service:8080/orders')
```

---

### Q19: Lambda 的 Provisioned Concurrency 和 Reserved Concurrency 区别？

**A:**

| 特性 | Reserved Concurrency | Provisioned Concurrency |
|------|---------------------|------------------------|
| **目的** | 限制最大并发 | 预热实例避免冷启动 |
| **费用** | 免费 | $0.000004646/GB-s |
| **实例状态** | 按需创建 | 保持初始化状态 |
| **使用场景** | 保护下游服务 | 延迟敏感应用 |

**配置 Reserved Concurrency**：
```bash
aws lambda put-function-concurrency \
  --function-name my-function \
  --reserved-concurrent-executions 100
```

**配置 Provisioned Concurrency**：
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name my-function \
  --qualifier PROD \
  --provisioned-concurrent-executions 500
```

**最佳实践组合**：
- 设置 Reserved Concurrency 防止过度扩展
- 设置 Provisioned Concurrency 保证核心容量
- 使用 Application Auto Scaling 自动调整 Provisioned Concurrency

---

### Q20: AWS Copilot CLI 是什么？与 CDK、Terraform 的区别？

**A:**

**AWS Copilot**：
- 面向容器应用的高级抽象 CLI
- 内置最佳实践（ECS/Fargate）
- 快速从代码到生产

**对比**：

| 工具 | 抽象层级 | 目标用户 | 输出 |
|------|----------|----------|------|
| **Copilot** | 应用级 | 开发者 | ECS/Fargate/管道 |
| **CDK** | 基础设施级 | 平台工程师 | CloudFormation |
| **Terraform** | 基础设施级 | DevOps | 多云资源 |

**Copilot 工作流**：
```bash
# 1. 初始化应用
copilot app init my-app

# 2. 创建环境
copilot env init --name production

# 3. 部署服务
copilot svc init --name api
copilot svc deploy --name api --env production

# 4. 添加管道
copilot pipeline init
copilot pipeline update
```

**适用场景**：
- 快速启动容器项目
- 不想管理底层基础设施
- 内置 CI/CD 需求

---

## 三、AI/ML 与生成式 AI 篇（10题）

### Q21: Amazon Bedrock 是什么？与 SageMaker JumpStart、OpenAI API 的区别？

**A:**

**Amazon Bedrock**：
- 托管的基础模型服务
- 统一 API 访问多个模型（Claude、Llama、Stable Diffusion、Amazon Titan）
- 无需管理基础设施
- 数据不离开 AWS

**对比**：

| 特性 | Bedrock | SageMaker JumpStart | OpenAI API |
|------|---------|-------------------|------------|
| **模型选择** | 多厂商 | AWS 托管/社区 | OpenAI 独占 |
| **定制能力** | Fine-tuning | 完整训练 | 有限 |
| **基础设施** | 无服务器 | 需配置实例 | 无服务器 |
| **数据隐私** | VPC 支持 | 完全控制 | 依赖 OpenAI |
| **成本** | 按 token | 实例+存储 | 按 token |

**Bedrock 调用示例**：

```python
import boto3

bedrock = boto3.client('bedrock-runtime')

response = bedrock.invoke_model(
    modelId='anthropic.claude-3-sonnet-20240229-v1:0',
    body={
        'anthropic_version': 'bedrock-2023-05-31',
        'max_tokens': 1000,
        'messages': [{
            'role': 'user',
            'content': '解释 AWS Lambda 的工作原理'
        }]
    }
)
```

**关键特性**：
- **Knowledge Bases**：RAG 应用（连接 S3/OpenSearch）
- **Agents**：多步骤任务执行
- **Guardrails**：内容安全过滤

---

### Q22: Amazon SageMaker 的 Trainium (Trn1) 和 Inferentia (Inf2) 实例是什么？

**A:**

**Trainium (Trn1)**：
- AWS 自研训练芯片
- 比 GPU 成本低 50%
- 支持大模型分布式训练

**Inferentia (Inf2)**：
- AWS 自研推理芯片
- 比 GPU 成本低 40%
- 支持 175B+ 参数模型推理

**使用 Neuron SDK**：

```python
# 训练代码适配
import torch
import torch_neuronx

# 编译模型为 Neuron 格式
model = MyModel()
model = torch_neuronx.trace(model, example_inputs)

# 保存供 Inferentia 使用
torch.jit.save(model, 'model_neuron.pt')
```

**SageMaker 训练作业**：

```python
from sagemaker.pytorch import PyTorch

estimator = PyTorch(
    entry_point='train.py',
    role=role,
    instance_type='ml.trn1.2xlarge',  # Trainium 实例
    instance_count=4,
    distribution={'torch_distributed': {'enabled': True}}
)
```

**适用场景**：
- 大规模语言模型训练 → Trainium
- 高并发低延迟推理 → Inferentia
- 成本优化优先 → 替代 GPU

---

### Q23: Amazon Q Developer 和 Amazon Q Business 的区别？

**A:**

| 特性 | Amazon Q Developer | Amazon Q Business |
|------|-------------------|-------------------|
| **目标用户** | 开发者 | 企业用户 |
| **核心功能** | 代码生成/解释/优化 | 企业知识问答 |
| **集成** | IDE/CLI/控制台 | 企业应用/文档 |
| **数据来源** | 代码仓库/文档 | 企业内部数据 |
| **安全** | IAM | VPC/加密隔离 |

**Q Developer 功能**：
- 代码补全（IDE 插件）
- 代码审查建议
- 安全漏洞扫描
- AWS 最佳实践建议

**Q Business 功能**：
- 连接 S3/SharePoint/Slack/Teams
- 基于企业数据的问答
- 生成摘要和报告

**使用 Q Developer**：

```bash
# VS Code 安装 Amazon Q 插件
# 快捷键触发建议

# CLI 使用
aws q developer generate-tests \
  --cli-input-json file://code-snippet.json
```

---

### Q24: Bedrock 的 Knowledge Base for RAG 如何工作？与直接调用 LLM 的区别？

**A:**

**RAG (Retrieval-Augmented Generation) 架构**：

```
用户问题 → Embedding → 向量搜索(OpenSearch) → 相关文档 → LLM → 回答
               ↑_________________________________↓
                           知识库
```

**Bedrock Knowledge Base 组件**：

1. **数据源**：S3、Confluence、Salesforce
2. **Embedding Model**：Titan Embeddings
3. **向量数据库**：OpenSearch Serverless、Pinecone、Redis
4. **大模型**：Claude、Llama 等

**创建知识库**：

```bash
aws bedrock-agent create-knowledge-base \
  --name product-docs \
  --role-arn arn:aws:iam::123456789012:role/BedrockRole \
  --knowledge-base-configuration '{
    "type": "VECTOR",
    "vectorKnowledgeBaseConfiguration": {
      "embeddingModelArn": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1"
    }
  }'
```

**使用 RAG**：

```python
response = bedrock_agent.retrieve_and_generate(
    input={'text': '我们的产品支持哪些数据库？'},
    retrieveAndGenerateConfiguration={
        'type': 'KNOWLEDGE_BASE',
        'knowledgeBaseConfiguration': {
            'knowledgeBaseId': 'kb-xxx',
            'modelArn': 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0'
        }
    }
)
```

**vs 直接调用**：
- RAG：基于事实、可溯源、无幻觉
- 直接调用：可能幻觉、无时效性

---

### Q25: SageMaker Model Registry 和 Feature Store 的最佳实践？

**A:**

**Model Registry**：

```python
from sagemaker.model_registry.model_package import ModelPackage

# 注册模型版本
model_package = ModelPackage(
    model_package_name='customer-churn-model',
    model_package_group_name='customer-churn',
    model_data='s3://bucket/model.tar.gz',
    approval_status='PendingManualApproval'
)

# CI/CD 集成
# 批准后自动部署到 SageMaker Endpoint
```

**Feature Store**：

```python
from sagemaker.feature_store.feature_group import FeatureGroup

# 创建特征组
feature_group = FeatureGroup(
    name='customer-features',
    sagemaker_session=sagemaker_session
)

# 在线存储（低延迟推理）
# 离线存储（训练数据集）
```

**最佳实践**：

1. **模型版本控制**：
   - 使用 Model Package Groups
   - 标记 `Approved/Rejected/Pending`

2. **特征共享**：
   - 跨团队复用特征
   - 在线/离线一致性

3. **血缘追踪**：
   - 记录特征→模型→端点的关系

---

### Q26: AWS Inferentia2 上的大模型推理优化技巧？

**A:**

**优化策略**：

1. **连续批处理 (Continuous Batching)**：
```python
from transformers_neuronx import LlamaForSampling

# 启用批处理
model = LlamaForSampling.from_pretrained(
    'meta-llama/Llama-2-70b',
    batch_size=4,  # 动态批处理
    tp_degree=8    # 张量并行
)
```

2. **推测解码 (Speculative Decoding)**：
- 小模型生成候选 token
- 大模型验证
- 2x 吞吐提升

3. **KV Cache 优化**：
```python
# 使用 Neuron 的滚动 KV Cache
model = LlamaForSampling.from_pretrained(
    model_path,
    n_positions=8192,
    context_length_estimate=4096
)
```

4. **模型分片**：
- 跨多个 Inferentia2 芯片
- 自动张量并行

---

### Q27: Amazon Bedrock Guardrails 如何配置内容安全？

**A:**

**Guardrails 功能**：
- 被过滤主题（拒绝回答）
- 敏感信息过滤（PII 脱敏）
- 词语过滤
- 提示词攻击防护

**配置示例**：

```json
{
  "name": "safe-ai-guardrail",
  "contentPolicyConfig": {
    "filtersConfig": [
      {"type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH"},
      {"type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "MEDIUM"},
      {"type": "INSULTS", "inputStrength": "MEDIUM", "outputStrength": "LOW"}
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      {"type": "EMAIL", "action": "BLOCK"},
      {"type": "PHONE", "action": "ANONYMIZE"}
    ]
  },
  "wordPolicyConfig": {
    "wordsConfig": [
      {"text": "竞争对手名称"}
    ]
  }
}
```

**使用 Guardrail**：

```python
response = bedrock_runtime.apply_guardrail(
    guardrailIdentifier='gr-xxx',
    guardrailVersion='1',
    source='OUTPUT',
    content=[{'text': model_output}]
)
```

---

### Q28: SageMaker Pipelines 如何构建 ML CI/CD？

**A:**

**Pipeline 定义**：

```python
from sagemaker.workflow.pipeline import Pipeline
from sagemaker.workflow.steps import ProcessingStep, TrainingStep

# 数据预处理
processing_step = ProcessingStep(
    name='DataPreprocessing',
    processor=sklearn_processor,
    inputs=[ProcessingInput(source=s3_input, destination='/opt/ml/processing/input')],
    outputs=[ProcessingOutput(output_name='train', source='/opt/ml/processing/train')]
)

# 训练
training_step = TrainingStep(
    name='ModelTraining',
    estimator=xgb_estimator,
    inputs={'train': processing_step.properties.ProcessingOutputConfig.Outputs['train'].S3Output.S3Uri}
)

# 条件注册
condition_step = ConditionStep(
    name='AccuracyCheck',
    conditions=[ConditionGreaterThanOrEqualTo(
        left=training_step.properties.ModelMetrics.ModelQuality.Statistics.Content['Accuracy'],
        right=0.8
    )],
    if_steps=[register_step],
    else_steps=[fail_step]
)

pipeline = Pipeline(
    name='CustomerChurnPipeline',
    steps=[processing_step, training_step, condition_step]
)
```

**集成 EventBridge**：
- S3 有新数据 → 触发 Pipeline
- Pipeline 完成 → 通知 SNS → 触发部署

---

### Q29: AWS Trainium 上的分布式训练配置？

**A:**

**EFA + NeuronLink**：

```python
# 启动分布式训练作业
from sagemaker.pytorch import PyTorch

estimator = PyTorch(
    entry_point='distributed_train.py',
    role=role,
    instance_type='ml.trn1.32xlarge',  # 16 Trainium 芯片
    instance_count=4,  # 64 芯片总计
    distribution={
        'torch_distributed': {
            'enabled': True
        }
    },
    hyperparameters={
        'model': 'llama-2-70b',
        'tensor_parallel_size': 8,
        'pipeline_parallel_size': 4
    }
)
```

**训练脚本适配**：

```python
import torch
import torch.distributed as dist
import torch_neuronx

# 初始化进程组
dist.init_process_group(backend='xla')

# 加载模型并分片
model = LlamaForCausalLM.from_pretrained('model_path')
model = torch_neuronx.parallelize(model, mesh=get_mesh())
```

---

### Q30: 如何评估和选择合适的 Bedrock 基础模型？

**A:**

**评估维度**：

| 维度 | 测试方法 | 模型对比 |
|------|----------|----------|
| **准确性** | 标准基准测试 | Claude > Llama > Titan |
| **速度** | Tokens/second | Titan > Llama > Claude |
| **成本** | $/1M tokens | Titan < Llama < Claude |
| **多语言** | 中文/日文测试 | Claude 3 > Claude 2 |
| **代码能力** | HumanEval | Claude 3 Opus 最佳 |

**Prompt 工程测试**：

```python
models = [
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'meta.llama3-70b-instruct-v1:0',
    'amazon.titan-text-express-v1'
]

for model_id in models:
    response = bedrock.invoke_model(
        modelId=model_id,
        body={'prompt': test_prompt, 'max_tokens': 500}
    )
    # 记录延迟、成本、质量评分
```

**决策建议**：
- 通用任务 → Claude 3 Sonnet
- 成本敏感 → Titan Text
- 开源需求 → Llama 3
- 最高质量 → Claude 3 Opus

---

## 四、数据库与存储篇（10题）

### Q31: Aurora Limitless Database 是什么？与传统 Aurora 的区别？

**A:**

**Aurora Limitless（2024 预览版）**：
- 自动水平扩展的分布式数据库
- 突破单机写入瓶颈
- 兼容 PostgreSQL

**架构**：
```
路由层 (Routers) → 分片 (Shards)
         ↓
   事务协调器 (Transaction Coordinator)
```

**对比**：

| 特性 | Aurora PostgreSQL | Aurora Limitless |
|------|------------------|------------------|
| **最大存储** | 128TB | 无限制 |
| **写入扩展** | 单主 | 多分片并行写入 |
| **分片管理** | 手动 | 自动 |
| **跨分片事务** | 不支持 | 支持 |
| **兼容性** | 100% | ~95% |

**使用场景**：
- 写入密集型应用（>100k TPS）
- 超大表（>10TB）
- 高并发 OLTP

---

### Q32: DynamoDB 的 Global Tables 与 DAX (DynamoDB Accelerator) 的选择？

**A:**

**Global Tables**：
- 多区域主动-主动复制
- 低延迟本地读取
- 灾难恢复

**DAX**：
- 内存缓存（微秒级延迟）
- 与 DynamoDB API 兼容
- 单个区域

**决策矩阵**：

| 需求 | 解决方案 |
|------|----------|
| 全球低延迟写入 | Global Tables |
| 全球低延迟读取 | Global Tables |
| 微秒级延迟 | DAX |
| 跨Region容灾 | Global Tables |
| 热点数据缓存 | DAX |

**最佳实践组合**：
- Global Tables 用于多区域
- DAX 用于热点数据缓存

```python
# DAX 客户端
import amazondax

dax = amazondax.AmazonDaxClient(
    endpoints=['dax-cluster.abc.dax-clusters.us-east-1.amazonaws.com:8111']
)

# 相同 API，微秒级延迟
dax.get_item(TableName='Users', Key={'UserId': {'S': '123'}})
```

---

### Q33: ElastiCache Serverless 与集群模式有什么区别？

**A:**

**ElastiCache Serverless（2023新特性）**：
- 自动扩展缓存容量
- 按需付费（存储+请求）
- 无需管理节点

**对比**：

| 特性 | 自行设计集群 | Serverless |
|------|-------------|------------|
| **配置** | 选择节点类型/数量 | 零配置 |
| **扩展** | 手动/基于告警 | 自动秒级 |
| **高可用** | 需配置 Multi-AZ | 内置 |
| **成本模型** | 按节点小时 | 按 GB + ECPU |
| **使用场景** | 可预测负载 | 波动负载 |

**创建 Serverless 缓存**：

```bash
aws elasticache create-serverless-cache \
  --serverless-cache-name my-cache \
  --engine redis \
  --cache-capacity-config '{
    "ServerlessCache": {
      "ECPUPerSecond": 1000,
      "DataStorage": 10
    }
  }'
```

---

### Q34: S3 的 Intelligent-Tiering 各存储层和转换规则？

**A:**

**自动分层**：

| 层 | 访问频率 | 存储成本 |
|---|----------|----------|
| **Frequent Access** | 日常访问 | 标准层价格 |
| **Infrequent Access** | 30天未访问 | 40%节省 |
| **Archive Instant Access** | 90天未访问 | 68%节省 |
| **Archive Access** | 90-180+天 | 76%节省 |
| **Deep Archive Access** | 180天+ | 95%节省 |

**监控和归档**：
- 自动监控访问模式
- 无需 retrieval 费用（除 Archive/Deep Archive）
- 无最小存储期限

**配置**：

```bash
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket my-bucket \
  --id my-config \
  --intelligent-tiering-configuration '{
    "Status": "Enabled",
    "Tierings": [
      {"Days": 90, "AccessTier": "ARCHIVE_ACCESS"},
      {"Days": 180, "AccessTier": "DEEP_ARCHIVE_ACCESS"}
    ]
  }'
```

---

### Q35: RDS Proxy 解决了什么问题？与直接连接数据库的区别？

**A:**

**解决的问题**：
- Lambda/Serverless 应用的数据库连接激增
- 连接建立延迟（TLS 握手）
- 故障转移时的连接中断

**架构**：
```
应用 → RDS Proxy → 连接池 → RDS/Aurora
          ↓
    自动故障转移
```

**优势**：

| 特性 | 直接连接 | RDS Proxy |
|------|----------|-----------|
| **连接数** | 受数据库限制 | 10,000+ 多路复用 |
| **延迟** | 每次新建连接 | 连接复用 |
| **故障转移** | 应用重试 | 自动，透明 |
| **IAM 认证** | 需处理令牌 | 原生支持 |
| **成本** | $0 | 额外费用 |

**Lambda 使用 RDS Proxy**：

```python
import boto3
import pymysql

# 从 Secrets Manager 获取令牌
client = boto3.client('rds')
auth_token = client.generate_db_auth_token(
    DBHostname='proxy.endpoint',
    Port=3306,
    DBUsername='lambda_user',
    Region='us-east-1'
)

# 连接通过 Proxy
conn = pymysql.connect(
    host='proxy.endpoint',
    user='lambda_user',
    password=auth_token,
    database='mydb',
    ssl={'ca': 'rds-ca-2019-root.pem'}
)
```

---

### Q36: Timestream vs OpenSearch vs DynamoDB 用于时间序列数据的选择？

**A:**

| 特性 | Timestream | OpenSearch | DynamoDB |
|------|-----------|------------|----------|
| **专门优化** | 时间序列 | 搜索/日志 | 通用键值 |
| **写入性能** | 极高 | 高 | 极高 |
| **查询能力** | 时间函数丰富 | 全文搜索 | 简单查询 |
| **聚合查询** | 内置 | 需聚合 | 需手动 |
| **保留策略** | 自动分层 | 手动 ILM | TTL |
| **成本** | 低（按查询+存储） | 中等 | 中等 |

**选择建议**：
- **IoT 指标/监控** → Timestream
- **日志分析/APM** → OpenSearch
- **简单时序+事务** → DynamoDB + TTL

**Timestream 示例**：

```sql
SELECT BIN(time, 5m) as binned_time,
       AVG(measure_value::double) as avg_cpu
FROM "myDB"."myTable"
WHERE time > ago(1h)
  AND measure_name = 'cpu_utilization'
GROUP BY BIN(time, 5m)
ORDER BY binned_time DESC
```

---

### Q37: DocumentDB (with MongoDB compatibility) 的适用场景？

**A:**

**与 MongoDB Atlas 对比**：

| 特性 | DocumentDB | MongoDB Atlas |
|------|-----------|---------------|
| **兼容性** | MongoDB 3.6/4.0/5.0 | 原生 |
| **存储引擎** | Aurora 存储 | WiredTiger |
| **全球分布** | Global Clusters | 原生 |
| **成本** | 通常更低 | 更高 |
| **专有功能** | 无 | Atlas Search/Charts |

**适用场景**：
- 已有 MongoDB 应用迁移上云
- 需要与 AWS 服务深度集成
- 成本敏感

**不适用场景**：
- 使用 MongoDB 最新特性（4.4+）
- 需要 MongoDB Change Streams 高级功能
- 多文档 ACID 事务高频使用

---

### Q38: S3 Object Lambda 是什么？使用场景？

**A:**

**概念**：
- 在 GET 请求时动态转换对象
- Lambda 函数实时处理
- 无需存储多个版本

**使用场景**：
- 图片实时缩略图
- 数据脱敏（隐藏 PII）
- 格式转换（JSON → CSV）
- 解压档案

**架构**：
```
GET /image.jpg?width=200
      ↓
S3 Object Lambda
      ↓
Lambda 函数（调用原始对象 + 处理）
      ↓
返回 200px 缩略图
```

**配置**：

```json
{
  "FunctionArn": "arn:aws:lambda:us-east-1:123456789012:function:image-resizer",
  "SupportingAccessPoint": "arn:aws:s3:us-east-1:123456789012:accesspoint/original",
  "TransformationConfigurations": [{
    "Actions": ["GetObject"],
    "ContentTransformation": {
      "AwsLambda": {
        "FunctionArn": "arn:aws:lambda:us-east-1:123456789012:function:image-resizer"
      }
    }
  }]
}
```

---

### Q39: Neptune (图数据库) 与关系型数据库的区别？什么场景使用？

**A:**

**适用场景**：
- 知识图谱
- 社交网络分析
- 欺诈检测（关系网络）
- 推荐引擎

**对比关系型数据库**：

| 查询 | SQL (关系型) | Gremlin/Cypher (Neptune) |
|------|-------------|------------------------|
| 朋友的朋友 | 多表 JOIN | 单查询遍历 |
| 最短路径 | 复杂递归 | 内置算法 |
| 关系深度 | 性能指数下降 | 性能线性 |

**Neptune Analytics（新特性）**：
- 内存中图处理
- 支持数亿节点
- 内置图算法（PageRank、Community Detection）

---

### Q40: AWS Storage Gateway 的三种模式如何选择？

**A:**

| 模式 | 协议 | 使用场景 |
|------|------|----------|
| **File Gateway** | NFS/SMB | 文件共享、备份 |
| **Volume Gateway** | iSCSI | 块存储备份、DR |
| **Tape Gateway** | VTL | 替换物理磁带 |

**File Gateway 缓存模式**：
- 热数据本地缓存
- 冷数据自动转 S3
- 多站点共享

**Volume Gateway 模式**：
- **缓存模式**: 主数据在 S3，热数据本地
- **存储模式**: 全本地，异步备份到 S3

**选择建议**：
- 文件共享 → File Gateway
- 数据库备份 → Volume Gateway
- 合规归档 → Tape Gateway

---

## 五、安全、运维与成本优化篇（10题）

### Q41: AWS Security Lake 是什么？与 CloudTrail、GuardDuty 的关系？

**A:**

**Security Lake**：
- 安全数据湖（Open Cybersecurity Schema Framework - OCSF）
- 集中存储所有安全日志
- 与 SIEM/SOAR 集成

**数据来源**：
```
CloudTrail → Security Lake
GuardDuty → Security Lake
VPC Flow Logs → Security Lake
Route 53 Logs → Security Lake
第三方防火墙 → Security Lake
```

**使用场景**：
- 跨账户安全分析
- 威胁狩猎
- 合规报告

**查询示例**：
```sql
-- Amazon Athena 查询
SELECT *
FROM security_lake_ocsf_db.ocsf_cloudtrail
WHERE event_time > current_date - interval '7' day
  AND event_name IN ('PutBucketPolicy', 'DeleteBucketPolicy')
```

---

### Q42: AWS CloudWatch 跨账户和跨 Region 观测最佳实践？

**A:**

**架构**：
```
业务账户 (Region A/B) → CloudWatch → 观测账户 (中央)
                              ↓
                     CloudWatch Cross-Account
```

**配置步骤**：

1. **观测账户设置 Sink**：
```bash
aws oam create-sink \
  --name CentralMonitoring \
  --region us-east-1
```

2. **业务账户关联**：
```bash
aws oam create-link \
  --sink-identifier arn:aws:oam::central-account:sink/xxx \
  --label-template '$Account-$Region'
```

3. **统一 Dashboard**：
```json
{
  "widgets": [{
    "type": "metric",
    "properties": {
      "metrics": [
        ["prod-account-us-east-1", "CPUUtilization", "AutoScalingGroupName", "prod-asg"]
      ],
      "region": "us-east-1",
      "accountId": "123456789012"
    }
  }]
}
```

---

### Q43: AWS Cost Optimization Hub 和 Savings Plans 的最佳实践？

**A:**

**Cost Optimization Hub**：
- 集中查看所有节省建议
- 跨账户/跨 Region
- 优先级排序

**Savings Plans 类型**：

| 类型 | 折扣 | 灵活性 | 适用 |
|------|------|--------|------|
| **Compute** | 最高 66% | 任意 Region/实例/Fargate/Lambda | 通用 |
| **EC2 Instance** | 最高 72% | 仅指定 Region/家族 | 稳定负载 |
| **SageMaker** | 最高 64% | 任意 SageMaker 实例 | ML 工作负载 |

**购买策略**：
1. 分析 Cost Explorer 的每小时使用量
2. 从部分覆盖开始（70-80%）
3. 混合使用 Compute 和 EC2 Instance
4. 使用 Saver 自动购买建议

```python
# 使用 Cost Explorer API 分析
import boto3

ce = boto3.client('ce')

response = ce.get_savings_plans_utilization(
    TimePeriod={
        'Start': '2024-01-01',
        'End': '2024-12-31'
    }
)
```

---

### Q44: AWS Config 和 CloudTrail 的区别？如何配合使用？

**A:**

| 特性 | CloudTrail | AWS Config |
|------|-----------|------------|
| **记录内容** | API 调用 | 资源配置变更 |
| **时间维度** | 事件流 | 配置快照 |
| **合规检查** | 审计追踪 | 规则评估 |
| **查询方式** | Athena/CloudWatch | Config 查询 |

**配合使用**：
```
CloudTrail: 谁？什么时候？做了什么？
Config: 资源配置是什么？是否合规？
```

**Config Rules 示例**：
```python
# 检查 S3 加密
class S3EncryptionRule(AWSConfigRule):
    def evaluate_compliance(self, configuration_item):
        if configuration_item['resourceType'] != 'AWS::S3::Bucket':
            return 'NOT_APPLICABLE'
        
        if configuration_item['configuration'].get('serverSideEncryptionConfiguration'):
            return 'COMPLIANT'
        return 'NON_COMPLIANT'
```

---

### Q45: AWS Backup 的跨 Region 复制和跨账户备份如何配置？

**A:**

**备份计划配置**：

```json
{
  "BackupPlan": {
    "BackupPlanName": "ProductionBackup",
    "Rules": [{
      "RuleName": "DailyBackups",
      "TargetBackupVault": "arn:aws:backup:us-east-1:123456789012:backup-vault:Default",
      "ScheduleExpression": "cron(0 5 ? * * *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 120,
      "Lifecycle": {
        "MoveToColdStorageAfterDays": 30,
        "DeleteAfterDays": 365
      },
      "CopyActions": [{
        "DestinationBackupVaultArn": "arn:aws:backup:us-west-2:123456789012:backup-vault:Default",
        "Lifecycle": {
          "DeleteAfterDays": 180
        }
      }]
    }]
  }
}
```

**跨账户备份**：
1. 中央账户创建 Backup Vault
2. 业务账户授权中央账户访问
3. 业务账户 Backup Plan 配置 Copy Action 到中央 Vault

---

### Q46: AWS Well-Architected Framework 的六大支柱在 2024 年的更新？

**A:**

**支柱**：
1. **Operational Excellence** - 运营卓越
2. **Security** - 安全
3. **Reliability** - 可靠性
4. **Performance Efficiency** - 性能效率
5. **Cost Optimization** - 成本优化
6. **Sustainability** - 可持续性（2021 新增，2024 强化）

**2024 重点更新**：

**Sustainability 强化**：
- 使用 Graviton（能效比提升 60%）
- Spot 实例利用（减少闲置资源）
- S3 Intelligent-Tiering（优化存储能耗）
- 区域选择（选择可再生能源区域）

**AI/ML 最佳实践**：
- 负责任 AI 设计
- 训练数据治理
- 模型可解释性

---

### Q47: AWS CloudFormation StackSets 和 CDK StackSets 如何管理多账户基础设施？

**A:**

**StackSets 架构**：
```
管理员账户 → StackSet → OU/账户列表 → 各账户 Stack
```

**部署策略**：
- **Sequential**: 顺序部署，失败停止
- **Parallel**: 并行部署
- **Region Concurrency**: 控制跨区域并发

**CDK StackSets 示例**：

```typescript
import { StackSet, StackSetTarget, StackSetPermissionModel } from 'aws-cdk-lib/aws-cloudformation';

new StackSet(this, 'BaselineStackSet', {
  template: baselineTemplate,
  permissionModel: StackSetPermissionModel.SERVICE_MANAGED,
  target: StackSetTarget.fromOrganizationalUnits({
    organizationalUnits: ['ou-1234-56789012'],
    regions: ['us-east-1', 'eu-west-1']
  }),
  autoDeployment: {
    enabled: true,
    retainStacksOnAccountRemoval: false
  }
});
```

**使用场景**：
- 安全基线部署（GuardDuty/Config）
- 网络基础设置（VPC/TGW）
- IAM 角色标准化

---

### Q48: AWS Trusted Advisor 的实时检查和优先级建议？

**A:**

**检查类别**：

| 类别 | 示例检查 | 优先级 |
|------|----------|--------|
| **Cost Optimization** | Idle RDS, Underutilized EC2 | 高 |
| **Performance** | EBS Burst Balance, High Latency | 高 |
| **Security** | Public S3, Unrestricted SG | 紧急 |
| **Fault Tolerance** | Single AZ RDS, No Health Check | 高 |
| **Service Limits** | Approaching 80% limit | 中 |

**API 集成自动修复**：

```python
import boto3

support = boto3.client('support')

# 获取检查
response = support.describe_trusted_advisor_checks(language='en')

# 自动修复示例：关闭公共 S3 Bucket
def remediate_public_s3():
    s3 = boto3.client('s3')
    buckets = s3.list_buckets()['Buckets']
    
    for bucket in buckets:
        try:
            acl = s3.get_bucket_acl(Bucket=bucket['Name'])
            # 检查并修复公共访问...
        except:
            pass
```

---

### Q49: AWS Resilience Hub 如何评估应用韧性？

**A:**

**韧性评估维度**：
1. **可用性目标** (RTO/RPO)
2. **基础设施层** (EC2/RDS 多 AZ)
3. **区域韧性** (是否多区域)
4. **依赖分析** (外部服务依赖)

**使用流程**：
1. 导入 CloudFormation/CDK 应用
2. 设置韧性目标（RTO: 4h, RPO: 1h）
3. 运行评估
4. 获取改进建议

**示例输出**：
```json
{
  "assessmentResults": {
    "overallScore": 78,
    "recommendations": [
      {
        "resource": "MyRDSInstance",
        "issue": "Single AZ deployment",
        "impact": "High",
        "remediation": "Enable Multi-AZ"
      }
    ]
  }
}
```

---

### Q50: 作为 50W 年薪的 AWS 架构师，如何设计一套完整的企业级 Landing Zone？

**A:**

**Landing Zone 架构**：

```
管理账户 (Management)
├── Log Archive Account          # 集中日志
├── Audit Account               # Security/Config 聚合
└── 共享服务账户               # AD/DNS/Directory

组织单位 (OU)
├── Security OU                 # GuardDuty/Macie
├── Infrastructure OU           # Network/Transit
├── Workloads OU
│   ├── Production
│   └── Development
├── Sandbox OU                  # 实验环境
└── Suspended OU                # 待关闭账户
```

**核心组件**：

1. **网络架构**：
   - Transit Gateway 中枢
   - 每个账户独立 VPC
   - 网络防火墙 (Network Firewall)
   - PrivateLink 服务发布

2. **安全基线**：
   - SCP 策略（阻止高风险操作）
   - GuardDuty 全账户启用
   - Security Hub 中央聚合
   - AWS Config 规则集

3. **身份管理**：
   - SSO/Identity Center
   - 权限集（Permission Sets）
   - 临时凭证（无 IAM User）

4. **成本管控**：
   - 预算告警
   - 标签策略强制
   - 节省计划管理

5. **可观测性**：
   - CloudWatch Cross-Account
   - X-Ray 分布式追踪
   - CloudTrail Organization

**自动化流水线**：
```yaml
新账户创建:
  - Service Catalog 产品组合
  - Control Tower Custom Controls
  - Terraform/CDK 基线部署
  - 自动加入监控和备份
```

**工具链**：
- **AWS Control Tower**: 快速搭建
- **AWS Organizations**: 多账户管理
- **Service Catalog**: 标准化产品
- **Systems Manager**: 运营管理
- **IAM Identity Center**: 统一身份

---

## 📝 面试总结

**50W 年薪 AWS 架构师 =**
- **服务深度**：精通核心服务（EC2/S3/VPC/IAM/RDS）
- **架构广度**：多账户设计、混合云、容器、Serverless、AI/ML
- **成本意识**：优化策略、Reserved/Savings Plans、FinOps
- **安全思维**：零信任、合规、数据保护、威胁检测
- **自动化能力**：IaC、CI/CD、事件驱动自动化

**持续学习资源**：
- [AWS 官方文档](https://docs.aws.amazon.com/)
- [AWS Architecture Center](https://aws.amazon.com/architecture/)
- [AWS re:Invent 最新视频](https://www.youtube.com/awsreinvent)
- [AWS Well-Architected Labs](https://www.wellarchitectedlabs.com/)

---

*最后更新: 2026 版 | 涵盖服务: Bedrock, EKS Auto Mode, S3 Express One Zone, Aurora Limitless, Graviton4, Trainium/Inferentia2*