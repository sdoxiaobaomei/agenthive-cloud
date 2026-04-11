# RFC-001-Appendix: 阿里云 ACK 成本详细分析

> **文档类型**: 成本分析 / 云服务商选型  
> **目标**: 详细分析阿里云 ACK 的成本结构，验证是否可控
> **分析日期**: 2026-04-07

---

## 📊 快速结论

| 问题 | 答案 |
|------|------|
| **K8s 节点可以关机吗？** | ✅ **可以**。ECS 节点可以释放（删除），停止计费。集群可以保持（0节点），仅收管理费。
| **可以按量计费吗？** | ✅ **可以**。ACK 托管版支持按量付费，ECS 节点也支持按量付费或包年包月。
| **成本可控吗？** | ✅ **可控**。通过**自动扩缩容 + 闲时释放节点**，月成本可控制在 **¥500-3000** 之间。

---

## 1. 阿里云 ACK 成本构成

### 1.1 计费项清单

```
总成本 = 集群管理费 + 节点费用 + 存储费用 + 网络费用 + 其他
```

| 计费项 | 计费方式 | 单价（北京/上海/杭州） | 是否可省 |
|--------|----------|----------------------|----------|
| **ACK 托管集群 Pro 版管理费** | 按量付费 | **¥0.64/小时** (约 ¥460/月) | ❌ 必须付 |
| **ECS 节点（Worker）** | 按量/包年包月 | ¥0.1-0.5/小时 (看规格) | ✅ 可释放 |
| **块存储（系统盘/数据盘）** | 按量付费 | ¥0.7-1.0/GB/月 | ✅ 随节点释放 |
| **负载均衡 CLB** | 按量付费 | ¥0.025/小时 + 流量费 | ✅ 可删除 |
| **NAT 网关** | 按量付费 | ¥0.15-0.32/小时 | ⚠️ 可选 |
| **文件存储 NAS** | 按量付费 | ¥1.8-3.6/GB/月 | ✅ 可选 |
| **日志服务 SLS** | 按量付费 | 按写入量计费 | ⚠️ 可选 |
| **容器镜像 ACR** | 按量/包年包月 | ¥59-299/月 | ⚠️ 可选 |

> 💡 **关键发现**: ACK 集群管理费 **只要集群存在就要收费**，即使节点为 0。

---

## 2. 详细成本计算

### 2.1 基础费用（无法节省）

| 项目 | 费用/月 | 说明 |
|------|---------|------|
| ACK 托管集群 Pro 版 | **¥460** | 0.64元/小时 × 24 × 30 |
| **基础成本合计** | **¥460** | 即使一个节点都没有 |

### 2.2 节点费用（可弹性伸缩）

#### ECS 节点规格推荐

| 规格 | vCPU | 内存 | 按量付费/小时 | 包年包月/月 | 适用场景 |
|------|------|------|---------------|-------------|----------|
| ecs.c7.large | 2 | 4G | ¥0.35 | ¥180 | 轻量 Workspace |
| ecs.c7.xlarge | 4 | 8G | ¥0.70 | ¥360 | 标准 Workspace |
| ecs.c7.2xlarge | 8 | 16G | ¥1.40 | ¥720 | 大型项目 |
| ecs.g7.xlarge | 4 | 16G | ¥0.92 | ¥480 | 内存密集型 |

#### 存储费用

| 类型 | 单价 | 说明 |
|------|------|------|
| ESSD 云盘 PL0 | ¥0.7/GB/月 | 普通性能 |
| ESSD 云盘 PL1 | ¥1.0/GB/月 | 推荐 |
| ESSD 云盘 PL2 | ¥2.0/GB/月 | 高性能 |

#### 网络费用

| 项目 | 单价 | 说明 |
|------|------|------|
| CLB 实例费 | ¥0.025/小时 (¥18/月) | 每个 Ingress |
| CLB 流量费 | ¥0.8/GB | 流出流量 |
| EIP | ¥0.02/小时 + ¥0.8/GB | 可选 |
| NAT 网关 | ¥0.15/小时 (¥108/月) | 可选 |

---

## 3. 场景成本估算

### 场景 1: 开发测试（最小化成本）

**使用策略**: 白天工作（8小时），晚上释放所有节点

```
集群管理费:     ¥460/月  (必须)
ECS 节点:       0-1 节点，按需启动
├─ 1台 c7.large (工作8小时/天)
│  = 0.35 × 8 × 30 = ¥84/月
存储:           40GB × ¥1.0 = ¥40/月
CLB:            1个 = ¥18/月
─────────────────────────────
总计:           ¥602/月
```

> 💡 **技巧**: 晚上用脚本自动缩容到 0 节点，只保留集群。

### 场景 2: MVP 生产（小规模）

**使用策略**: 固定 2 节点（包年包月），支持 10-20 个 Workspace

```
集群管理费:     ¥460/月
ECS 节点:       2台 c7.xlarge (包年包月)
├─ 360 × 2 = ¥720/月
存储:           100GB × 2 = ¥200/月
CLB:            2个 = ¥36/月
日志 SLS:       基础版 = ¥50/月
─────────────────────────────
总计:           ¥1,466/月 (~$200)
```

### 场景 3: 完整生产（中等规模）

**使用策略**: 3 节点（包年包月）+ 自动扩缩容，支持 50-100 个 Workspace

```
集群管理费:     ¥460/月
ECS 节点:       
├─ 3台 c7.2xlarge (包年包月) = 720 × 3 = ¥2,160/月
├─ 弹性节点: 按量，假设平均 2 台 = ¥1,000/月
存储:           500GB = ¥500/月
CLB:            3个 = ¥54/月
NAT 网关:       1个 = ¥108/月
日志 SLS:       ¥200/月
镜像 ACR:       ¥100/月
─────────────────────────────
总计:           ¥4,482/月 (~$620)
```

### 场景 4: 弹性最优（推荐）

**使用策略**: 使用 **ACK Serverless（ASK）**，纯按量付费

```
ASK 集群:       免管理费（¥0）
ECI 弹性容器实例:
├─ 1 vCPU = ¥0.0001/秒 = ¥0.36/小时
├─ 1 GB 内存 = ¥0.00003/秒 = ¥0.11/小时

假设: 100 个 Workspace，每个平均运行 4 小时/天
├─ 每个 Workspace: 1vCPU + 2GB = ¥0.58/小时
├─ 日费用: 100 × 4 × 0.58 = ¥232
├─ 月费用: ¥232 × 30 = ¥6,960

存储 (NAS):     100GB = ¥180/月
CLB:            3个 = ¥54/月
─────────────────────────────
总计:           ¥7,194/月
```

> 💡 **ASK 优势**: 真正的 Serverless，不用时不花钱。但单价略高。

---

## 4. 成本优化策略

### 4.1 自动关机/缩容策略

#### 方案 A: HPA + Cluster Autoscaler（推荐）

```yaml
# 配置 HPA（Pod 级别自动扩缩）
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: workspace-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: workspace
  minReplicas: 0      # 最小 0，可以缩到没有
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
```

```yaml
# 配置 Cluster Autoscaler（节点级别）
# 节点池配置
apiVersion: apps/v1
kind: NodePool
metadata:
  name: auto-scaling-pool
spec:
  minSize: 0          # 可以缩到 0 节点
  maxSize: 10
  scalingPolicy: 
    scaleDownDelay: 10m    # 10分钟无负载就缩容
```

**效果**:
- 晚上无用户时：节点数 = 0，只付集群管理费 ¥460
- 白天有用户时：自动弹出节点

#### 方案 B: CronJob 定时关机

```yaml
# 每天晚上 22:00 缩容到 0
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-down-night
spec:
  schedule: "0 22 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kubectl
            image: bitnami/kubectl
            command:
            - /bin/sh
            - -c
            - |
              kubectl scale deployment workspace --replicas=0
              # 节点自动缩容（配合 Cluster Autoscaler）
          restartPolicy: OnFailure
```

### 4.2 包年包月 vs 按量付费对比

| 使用时长 | 按量付费 | 包年包月 | 建议 |
|----------|----------|----------|------|
| < 1 个月 | ¥500 | ¥360 | 按量付费 |
| 1-3 个月 | ¥1,500 | ¥1,080 | 按量付费 |
| > 3 个月 | >¥3,000 | ¥2,160 | **包年包月**（省 30%）|

> 💡 **混合策略**: 基础节点包年包月，弹性节点按量付费。

### 4.3 抢占式实例（Spot）

阿里云支持 **抢占式实例**（Spot），价格可达按量付费的 **10%-30%**。

```
ecs.c7.xlarge 按量付费: ¥0.70/小时
ecs.c7.xlarge 抢占式:   ¥0.07-0.21/小时  (节省 70-90%)
```

**注意事项**:
- ⚠️ 可能被回收（当库存不足时）
- ✅ 适合无状态服务（Workspace 可以迁移）
- ✅ 可以设置 "最高出价"，自动切换

```yaml
# 节点池配置抢占式实例
apiVersion: apps/v1
kind: NodePool
metadata:
  name: spot-pool
spec:
  instanceChargeType: Spot
  spotStrategy: SpotWithPriceLimit
  spotPriceLimit: 0.20    # 最高出价 0.20元/小时
```

---

## 5. 阿里云 vs AWS vs GCP 成本对比

### 5.1 同等配置对比（3 节点 × 4c8g）

| 云服务商 | 产品 | 月成本 | 特点 |
|----------|------|--------|------|
| **阿里云** | ACK + ECS | **¥1,466** | 国内延迟低，文档全 |
| **AWS** | EKS + EC2 | **$250 (~¥1,800)** | 生态最全，贵 |
| **GCP** | GKE + e2-standard-4 | **$200 (~¥1,440)** | 自动扩缩容强 |
| **腾讯云** | TKE + CVM | **¥1,200** | 便宜，但生态弱 |

### 5.2 Serverless 对比

| 云服务商 | 产品 | 单价 | 特点 |
|----------|------|------|------|
| **阿里云** | ASK (ECI) | ¥0.36/vCPU/小时 | 国内唯一成熟 Serverless K8s |
| **AWS** | Fargate | $0.04048/vCPU/小时 (~¥0.29) | 贵但稳定 |
| **GCP** | Autopilot | $0.10/vCPU/小时 (~¥0.72) | 按 Pod 计费，贵 |

> 💡 **阿里云 ASK 是国内唯一的生产级 Serverless K8s**，这是巨大优势。

---

## 6. 具体实施建议

### 6.1 推荐配置（成本最优）

```yaml
# 推荐架构：ACK 托管版 + Cluster Autoscaler + Spot 实例

集群配置:
  type: ACK 托管版 Pro
  region: 华东1（杭州）
  
节点池:
  - name: base-pool
    type: 包年包月
    instance: ecs.c7.xlarge × 2
    minSize: 2
    maxSize: 2
    cost: ¥720/月
    
  - name: elastic-pool
    type: 按量付费
    instance: ecs.c7.xlarge
    minSize: 0
    maxSize: 10
    cost: 按需
    
  - name: spot-pool
    type: 抢占式
    instance: ecs.c7.xlarge
    minSize: 0
    maxSize: 20
    spotPriceLimit: 0.20
    cost: ~¥0.15/小时

存储:
  - type: ESSD PL1
    size: 100GB × 2 (基础节点)
    cost: ¥200/月
    
网络:
  - CLB: 2个
  - NAT: 1个（可选）

监控:
  - SLS 日志: 按量
  - CMS 监控: 免费额度

预期成本:
  - 低峰期: ¥1,000/月 (基础节点)
  - 高峰期: ¥3,000/月 (弹性节点)
```

### 6.2 成本告警设置

```yaml
# 阿里云监控告警规则
alertRules:
  - name: daily-cost-alert
    condition: 日消费 > ¥200
    action: 发送钉钉/短信
    
  - name: monthly-budget-alert
    condition: 月消费 > ¥3,000
    action: 自动缩容 + 通知
    
  - name: idle-resource-alert
    condition: 节点 CPU < 10% 持续 1小时
    action: 建议缩容通知
```

### 6.3 自动化脚本

```bash
#!/bin/bash
# scale-workspace.sh - 自动扩缩容脚本

HOUR=$(date +%H)
DAY=$(date +%u)  # 1-5 工作日

# 工作时间: 9:00 - 22:00，周末最小化
if [ $HOUR -ge 9 ] && [ $HOUR -lt 22 ] && [ $DAY -le 5 ]; then
    echo "工作时间: 扩容到 3 节点"
    kubectl scale --replicas=3 nodepool/base-pool
else
    echo "非工作时间: 缩容到 1 节点"
    kubectl scale --replicas=1 nodepool/base-pool
fi
```

---

## 7. 风险控制

### 7.1 成本上限设置

```yaml
# 阿里云预算管理
budget:
  monthlyLimit: 5000  # 月预算 ¥5000
  alertThresholds:
    - 50%  # ¥2500 时预警
    - 80%  # ¥4000 时告警
    - 100% # ¥5000 时自动停机
  
  actions:
    - type: notification
      target: 钉钉群/邮件
    - type: autoScaling  
      target: disableAutoscaling  # 停止自动扩容
    - type: manualApproval
      target: 需要审批后才能继续
```

### 7.2 成本分摊策略

| 成本项 | 分摊方式 | 估算 |
|--------|----------|------|
| 基础成本（集群+基础节点） | 公司承担 | ¥1,000/月 |
| 弹性成本（按实际使用） | 按 Workspace 数分摊 | ¥0.5/小时/Workspace |
| 存储成本 | 按存储量分摊 | ¥1/GB/月 |

---

## 8. 结论与建议

### 8.1 成本可控性评估

| 指标 | 评估 | 说明 |
|------|------|------|
| **基础成本** | ✅ 可控 | 最低 ¥460/月（0 节点） |
| **弹性成本** | ✅ 可控 | 按需付费，用多少付多少 |
| **上限风险** | ✅ 可控 | 可设置预算上限，自动告警/停机 |
| **优化空间** | ✅ 大 | 抢占式实例可省 70% |

### 8.2 推荐方案（分阶段）

#### Phase 1: 验证期（1-3 个月）
- **产品**: ACK 托管版 + 按量付费 ECS
- **配置**: 2 节点 c7.large（开发时启动）
- **预期成本**: ¥600-1,500/月
- **策略**: 晚上手动关机

#### Phase 2: MVP 期（3-6 个月）
- **产品**: ACK 托管版 + 包年包月 ECS
- **配置**: 2 节点 c7.xlarge（固定）
- **预期成本**: ¥1,500/月
- **策略**: Cluster Autoscaler 自动扩缩

#### Phase 3: 生产期（6 个月+）
- **产品**: ACK 托管版 + 混合实例（包年包月 + 抢占式）
- **配置**: 2 基础 + 弹性
- **预期成本**: ¥2,000-4,000/月
- **策略**: 全自动化成本优化

### 8.3 关键决策点

| 决策 | 建议 | 理由 |
|------|------|------|
| **包年包月 vs 按量** | 混合使用 | 基础节点包年包月，弹性按量 |
| **抢占式实例** | 建议使用 | 省 70% 成本，适合无状态 Workspace |
| **ASK Serverless** | 暂缓 | 单价高，等规模大了再迁移 |
| **多地域** | 先单地域 | 上海/杭州，延迟低 |

---

## 9. 下一步行动

### 给 DevOps Agent 的任务

1. **申请阿里云账号** (1天)
   - 企业认证（享受折扣）
   - 配置预算告警

2. **创建测试集群** (2天)
   - ACK 托管版 Pro
   - 1 节点 c7.large（按量付费）
   - 验证基本功能

3. **成本验证实验** (3天)
   - 模拟白天工作/晚上关机场景
   - 验证自动扩缩容
   - 记录实际账单

4. **编写成本优化脚本** (2天)
   - 定时缩容 CronJob
   - 成本监控 Dashboard

### 预期首月账单

```
实验阶段（Week 1-2）: ¥200-500
验证阶段（Week 3-4）: ¥800-1,200
────────────────────────────
总计: ~¥1,500 (首月)
```

---

## 附录: 阿里云产品链接

- [ACK 托管版](https://www.aliyun.com/product/kubernetes)
- [ECS 定价](https://www.aliyun.com/price/product?spm=a2c4g.11186623.0.0.7a3b7e8a0x9x9x#/ecs/detail)
- [抢占式实例](https://help.aliyun.com/document_detail/52088.html)
- [集群 Autoscaler](https://help.aliyun.com/document_detail/119099.html)

---

**文档结束**

**核心结论**: 
- ✅ 阿里云 ACK 成本 **完全可控**
- ✅ 最低 **¥460/月** 就能跑起来（0 节点）
- ✅ 通过 **自动关机 + 抢占式实例**，生产环境可控制在 **¥1,500-3,000/月**
- ✅ 国内最佳选择，ASK 是唯一成熟的 Serverless K8s
