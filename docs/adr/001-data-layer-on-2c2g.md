# ADR-001: 两环境架构 — 本地 Dev + 生产灰度

- **状态**: 已采纳
- **日期**: 2026-05-03
- **更新**: 2026-05-03 (v2 — 砍掉 Staging)
- **决策者**: 项目负责人

## 背景

个人技术验证项目，不需要多环境隔离。Staging 环境额外占用 4C8G 服务器，
且与 Production 配置漂移，验证价值有限。

## 决策

**只保留两个环境：本地 Dev + Production（灰度部署）**

```
┌─────────────────────────────────────────────────────┐
│  💻 本地 PC (Dev)                                    │
│  Docker Compose 全栈自包含                           │
│  开发 + 集成测试 + 上线前人工验证                     │
├─────────────────────────────────────────────────────┤
│  🗄️ 2C2G 阿里云 (Prod 数据层)                       │
│  PostgreSQL 15 (4 databases) + Redis 7              │
│  pg_dump → OSS 每日备份                              │
├─────────────────────────────────────────────────────┤
│  🏭 8C16G 抢占式 (Prod 应用层 + 灰度)                │
│  K3s + Nacos + RabbitMQ                             │
│  Nginx Ingress Canary → 灰度账号路由到新版本          │
│  自动化冒烟测试通过 → 全量发布                        │
├─────────────────────────────────────────────────────┤
│  🧪 4C8G Kimiclaw (待定)                             │
│  方案 A: ArgoCD + 监控栈 (独立控制平面)               │
│  方案 B: 退掉省钱                                    │
└─────────────────────────────────────────────────────┘
```

## 灰度发布流程

```
1. 本地 Dev 验证通过 → 合并 master
2. CI 构建镜像 → push ACR
3. 手动/自动触发 deploy (canary weight=10%)
4. 灰度账号访问 → 自动化冒烟测试
5. 测试通过 → 全量发布 (canary weight=100%)
6. 测试失败 → 自动回滚 (helm rollback)
```

### 灰度路由实现 (Nginx Ingress Canary)

```yaml
# 稳定版 Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-stable
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: api.agenthive.cloud
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-stable
                port:
                  number: 3000

---
# 灰度版 Ingress (by cookie/header)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-by-cookie: "agenthive-canary"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
    - host: api.agenthive.cloud
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-canary
                port:
                  number: 3000
```

**灰度账号**: Cookie `agenthive-canary=always` → 流量路由到 canary 版本
**权重灰度**: `canary-weight=10` → 10% 随机流量走 canary

### 自动化冒烟测试

```bash
# scripts/deploy/smoke-test-canary.sh
# 在灰度版本上运行冒烟测试

CANARY_URL="https://api.agenthive.cloud"
COOKIE="agenthive-canary=always"

# 1. Health check
curl -s -b "$COOKIE" "$CANARY_URL/health" | jq .status | grep -q ok

# 2. API 核心链路
curl -s -b "$COOKIE" -X POST "$CANARY_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"smoke test"}' | jq .success | grep -q true

# 3. 登录验证
TOKEN=$(curl -s -b "$COOKIE" -X POST "$CANARY_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"canary-test","password":"***"}' | jq -r .token)

[ -n "$TOKEN" ] && echo "✅ Smoke test passed" || { echo "❌ Smoke test failed"; exit 1; }
```

## 理由

1. **个人项目不需要 Staging** — 一个人开发，Staging 和 Prod 配置必然漂移，维护成本 > 价值
2. **灰度 > Staging** — 真实生产环境 + 真实数据验证，比隔离环境更可靠
3. **省钱** — 砍掉 4C8G（如选择方案 B），每月省 ¥200+
4. **2C2G 更宽裕** — 只服务 Prod，4 库 + 128MB Redis，内存占用 ~1GB / 2GB

## 数据层详情

```
2C2G PostgreSQL:
  prod_agent    → 用户: prod_agent
  prod_chat     → 用户: prod_chat
  prod_project  → 用户: prod_project
  prod_user     → 用户: prod_user

2C2G Redis:
  db0: production
  db1: (reserved)
```

## 约束与缓解

| 风险 | 缓解措施 |
|------|---------|
| 灰度 bug 影响真实用户 | `canary-weight=10` + Cookie 路由，先只测灰度账号 |
| 灰度测试不充分 | 自动化冒烟 + 人工灰度账号验证 |
| 2C2G 单点 | pg_dump 每日备份到 OSS |
| 抢占式实例回收 | ESSD 云盘持久化 + 自动重建脚本 |

## 未来演进

- 有收入 → 上 RDS + 多可用区
- 团队扩大 → 重新引入 Staging
- 灰度成熟 → Argo Rollouts 自动化灰度 + 自动回滚

## 变更历史

- v2 (2026-05-03): 砍掉 Staging，改为 Dev + Prod 灰度
- v1 (2026-05-03): 初始版本，4 环境架构
