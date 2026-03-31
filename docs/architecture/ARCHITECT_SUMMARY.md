# 架构师陈述摘要

**主讲**: Tech Lead Agent  
**时间**: 2026-03-31  
**主题**: AgentHive Cloud 架构设计

---

## 🎯 一句话总结

> AgentHive是一个**云原生的可视化AI团队协作平台**，通过K8s编排多个Agent Pod，实时展示AI开发过程，并允许人类随时干预。

---

## 🏗️ 四层架构

```
┌─────────────────────────────────────┐
│  Layer 4: 展示层 (Vue3 SPA)          │
│  - Agent仪表板、代码编辑器、终端      │
├─────────────────────────────────────┤
│  Layer 3: 控制层 (Go Supervisor)     │
│  - API网关、任务调度、状态管理        │
├─────────────────────────────────────┤
│  Layer 2: 执行层 (K8s Agent Pods)    │
│  - Director、Backend Dev、Frontend   │
├─────────────────────────────────────┤
│  Layer 1: 基础设施 (Redis/PG/MinIO)  │
│  - 状态缓存、数据持久、文件存储       │
└─────────────────────────────────────┘
```

---

## 🔑 三个核心设计决策

### 1. 为什么用K8s作为Agent运行时？

**问题**: Agent需要隔离、扩展、管理

**决策**: 每个Agent是一个K8s Pod

**好处**:
- ✅ 资源隔离（CPU/内存限制）
- ✅ 故障自愈（Pod崩溃自动重启）
- ✅ 水平扩展（HPA自动扩缩容）
- ✅ 配置管理（ConfigMap/Secret）

---

### 2. 为什么用WebSocket做实时通信？

**问题**: 用户需要看到Agent实时工作状态

**决策**: Supervisor ↔ Agent ↔ Web UI 全双工WebSocket

**好处**:
- ✅ 低延迟（<200ms）
- ✅ 双向通信（Agent上报 + 用户干预）
- ✅ 标准协议（浏览器原生支持）

---

### 3. 为什么分离Supervisor和Agent？

**问题**: 需要集中管理和分布式执行

**决策**: 
- Supervisor: 单点控制（调度、协调）
- Agent: 分布式执行（实际干活）

**好处**:
- ✅ 职责分离
- ✅ 独立扩展
- ✅ 故障隔离

---

## 📊 关键技术指标

| 指标 | 设计值 | 说明 |
|------|--------|------|
| 任务调度延迟 | <100ms | Go channel + Redis |
| 状态同步延迟 | <200ms | WebSocket直连 |
| 单Supervisor支持Agent | >100 | 可水平扩展 |
| Agent启动时间 | <10s | 镜像预热 |
| 代码增量更新 | <500ms | diff传输 |

---

## 🔐 安全设计

```
Internet
   │ HTTPS
   ▼
Ingress
   │ mTLS
   ▼
Supervisor
   │ RBAC
   ▼
Agent Pods (沙箱)
   │ 只读rootfs
   ▼
Internal Services
```

---

## 🚀 扩展性设计

### 水平扩展Agent
```yaml
# HPA配置
minReplicas: 1
maxReplicas: 10
metrics:
- task_queue_depth > 5  # 任务多就扩容
```

### 新增Agent角色
只需3步：
1. 写YAML配置（能力、资源）
2. 实现运行时逻辑
3. 更新Helm values

---

## 💡 创新点

1. **白盒AI**: 不是黑盒调用，而是可视化整个开发过程
2. **人机协作**: Agent自动工作 + 人类随时干预
3. **云原生**: 利用K8s生态，企业级部署
4. **实时反馈**: 代码、终端、状态全部实时同步

---

## 📚 详细文档

- [完整架构设计](ARCHITECTURE_EXPLANATION.md)
- [数据流详解](DATA_FLOW.md)
- [API文档](../api/)

---

**架构师**: Tech Lead Agent 🏗️  
**状态**: ✅ 设计完成，等待实现
