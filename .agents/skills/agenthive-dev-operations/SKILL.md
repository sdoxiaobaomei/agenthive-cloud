---
name: agenthive-dev-operations
description: AgentHive Cloud 开发环境运维与调试实战指南。涵盖 k3d 集群、Helm 部署、PostgreSQL migration、前后端类型不匹配、内存管理等常见问题的快速诊断与修复。
---

# AgentHive Cloud — 开发运维实战指南

> 本 skill 汇总了 AgentHive Cloud 项目在 develop 分支上的所有实战踩坑记录。
> 适用场景：本地 k3d 开发环境调试、Helm 部署修复、前后端联调问题排查。

---

## 环境拓扑速查

```
┌─────────────────────────────────────────────────────────────┐
│  Windows Host (32GB RAM)                                     │
│  ├── Docker Desktop → k3d cluster "agenthive-dev"           │
│  │   ├── k3d-server-0  (控制平面, ~2.2GB)                    │
│  │   ├── k3d-agent-0   (工作负载, ~2.9GB)                    │
│  │   └── k3d-serverlb  (LB, 31MB)                           │
│  │       └── Namespace: agenthive                            │
│  │           ├── api (Node.js + Express)                     │
│  │           ├── landing (Nuxt 3 SSR)                        │
│  │           ├── auth-service / gateway-service (Spring Boot)│
│  │           ├── postgres / redis / nacos / rabbitmq         │
│  ├── ACR Registry: crpi-89ktoa4wv8sjcdow.cn-beijing...      │
│  └── Helm Release: agenthive-dev @ namespace agenthive      │
└─────────────────────────────────────────────────────────────┘
```

**关键端口**：
- Landing: http://localhost:8080 (via k3d lb)
- API: http://localhost:8080/api (via gateway)
- Grafana (如有): http://localhost:3003

---

## 快速诊断命令

### 1. 集群状态快照
```bash
# 一键查看所有关键状态
kubectl get pods -n agenthive
kubectl get deployment -n agenthive
helm list -n agenthive
kubectl top pod -n agenthive
```

### 2. API 错误快速定位
```bash
# 查看最新错误日志
kubectl logs -l app.kubernetes.io/name=api -n agenthive --tail=50 | grep -i error

# 跟踪实时日志
kubectl logs -f deployment/api -n agenthive

# 查看特定 pod 日志
kubectl logs <pod-name> -n agenthive --tail=100
```

### 3. 数据库快速操作
```bash
# 进入 postgres
kubectl exec postgres-xxx -n agenthive -- psql -U agenthive

# 查看 migrations
kubectl exec postgres-xxx -n agenthive -- psql -U agenthive -c "SELECT name, run_on FROM _migrations ORDER BY run_on;"

# 查看表结构
kubectl exec postgres-xxx -n agenthive -- psql -U agenthive -c "\d chat_sessions"
```

### 4. 本地测试 API
```bash
# Port forward 后本地测试
kubectl port-forward deployment/api 3001:3001 -n agenthive

# 健康检查
curl http://localhost:3001/api/health

# 创建项目
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <user-id>" \
  -d '{"name":"test","type":"blank"}'
```

---

## 已知问题库（症状 → 根因 → 修复）

### Issue-001: 聊天创建会话 500 — duplicate key violates unique constraint

**症状**：`POST /api/chat/sessions` 返回 500，日志显示：
```
duplicate key value violates unique constraint "idx_chat_sessions_project_id_unique"
```

**根因**：数据库约束要求每个 `project_id` 只能有一个 `chat_session`，但 `createSession` 直接 `INSERT` 不做检查。

**修复**（`chat-controller/service.ts`）：
```typescript
// 如果指定了 projectId，先查找是否已有活跃的 session
if (projectId) {
  const existing = await pool.query(
    `SELECT * FROM chat_sessions WHERE project_id = $1 AND status = 'active' LIMIT 1`,
    [projectId]
  )
  if (existing.rowCount && existing.rowCount > 0) {
    return dbRowToSession(existing.rows[0])  // 复用已有 session
  }
}
```

---

### Issue-002: 创建项目 500 — invalid input syntax for type json

**症状**：`POST /api/projects` 返回 500，日志显示：
```
error: invalid input syntax for type json (code: 22P02)
```

**根因**：前端 `dashboard.vue` 传 `techStack: 'react'`（字符串），但数据库 `projects.tech_stack` 是 `JSONB` 类型。PG 无法把 `'react'` 解析为 JSON。

**修复**（`project/service.ts`）：
```typescript
function normalizeTechStack(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    try { JSON.parse(value); return value } catch { /* not valid JSON */ }
    return JSON.stringify([value])  // "react" → ["react"]
  }
  if (Array.isArray(value)) return JSON.stringify(value)
  return null
}
```

**教训**：前端传字符串、后端存 JSONB 时，后端必须做防御性转换。

---

### Issue-003: PostgreSQL migration 语法错误 — ADD CONSTRAINT IF NOT EXISTS

**症状**：migration 执行失败：
```
syntax error at or near "NOT"
```

**根因**：PostgreSQL 16 不支持 `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS` 语法。

**修复**：使用 `DO $$` 匿名代码块：
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_project_deployments_project_id'
  ) THEN
    ALTER TABLE project_deployments ADD CONSTRAINT uq_project_deployments_project_id UNIQUE (project_id);
  END IF;
END $$;
```

---

### Issue-004: Migration 顺序错乱 — Not run migration X is preceding already run migration Y

**症状**：node-pg-migrate 报错：
```
Not run migration 20260505000100_add-repo-url-to-projects is preceding already run migration 20260505000200
```

**根因**：之前手动 `ALTER TABLE` 添加了列，但没有手动插入对应的 migration 记录到 `_migrations` 表。

**修复**：
```sql
-- 手动插入缺失的 migration 记录
INSERT INTO _migrations (name, run_on) VALUES ('20260505000100_add-repo-url-to-projects', NOW());
```

**预防**：任何手动 schema 变更后，必须同步 `_migrations` 表。

---

### Issue-005: Helm upgrade 死锁 — another operation is in progress

**症状**：
```
Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress
```

**根因**：之前的 Helm upgrade 失败（如 db-migrate hook 失败），release 处于 `pending-upgrade` 状态。

**修复**：
```bash
# 1. 查看状态
helm list -n agenthive --all

# 2. Rollback 到上一个成功版本
helm rollback agenthive-dev <last-successful-rev> -n agenthive

# 3. 清理失败的 Job
kubectl delete job -l app.kubernetes.io/managed-by=Helm -n agenthive

# 4. 重新 upgrade
helm upgrade agenthive-dev chart/agenthive --namespace agenthive --reuse-values
```

---

### Issue-006: Secret 丢失导致 Pod CreateContainerConfigError

**症状**：新 Pod 状态 `CreateContainerConfigError`，describe 显示：
```
Error: secret "app-secrets" not found
```

**根因**：`a71bc90` 提交删除了 Helm-managed Secret 生成逻辑，导致 dev 环境 `app-secrets` 不被创建。

**修复**：恢复 `secret.yaml` 三种模式：
- 模式 A：`externalSecret.enabled=true` → ExternalSecret CRD
- 模式 B：`createEmpty=true` → 空 Secret（外部注入）
- 模式 C：否则 → Helm-managed Secret（从 `secret.data` 读取）

---

### Issue-007: API 返回 400 — 会话 ID 格式错误

**症状**：`GET /api/chat/sessions/conv-123` 返回 400：
```json
{"code": 400, "message": "会话 ID 格式错误: \"conv-123\" 不是有效的 UUID"}
```

**根因**：前端旧代码在 catch 块中生成了 `conv-${Date.now()}` 等非 UUID 格式的 ID，后端期望 RFC 4122 UUID。

**修复**：
1. 后端添加 UUID 校验（`utils/validators.ts`）
2. 前端删除 catch 块的 mock fallback ID 生成

---

## 数据库 Migration 管理规范

### 添加新 migration
```bash
# 1. 命名规范：YYYYMMDDhhmmss_description.sql
touch apps/api/src/db/migrations/20260506120000_add-column-to-table.sql

# 2. 内容模板
-- up migration
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE;

-- down migration
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
```

### 关键规则
1. **PG 16 不支持 `IF NOT EXISTS` 的约束语法** → 用 `DO $$` 块包裹
2. **clean DB 全量测试**：每次新 migration 必须在干净数据库上测试
3. **手动 ALTER TABLE 后必须同步 `_migrations`**：
   ```sql
   INSERT INTO _migrations (name, run_on) VALUES ('<migration_name>', NOW());
   ```
4. **12 条 migration 是历史记录**，不要随意删除或修改已执行的 migration

---

## Helm Chart 陷阱

### 陷阱 1：image 名称不匹配
`values.dev.yaml` 中 `repository: namespace-alpha/api`，但 Docker image 实际叫 `namespace-alpha/agenthive-api`。

**修复**：统一为 `namespace-alpha/agenthive-api`。

### 陷阱 2：prod values 被降配
`a71bc90` 把 prod 的 replicas 从 3 降到 1，HPA/PDB 全禁用。

**正确做法**：prod 保持生产级配置，dev 才是单节点配置。

### 陷阱 3：registry secret 在 prod 中硬编码凭据
不要在 `values.prod.yaml` 中写 `registry.username/password`。

**正确做法**：`registry.enabled: false`，使用 node-level imagePullSecret。

### 陷阱 4：maxUnavailable: 0 导致单节点死锁
在单节点 k3d 上，`maxUnavailable: 0` 会让滚动更新永远无法完成（没有多余节点调度新 Pod）。

**正确做法**：默认值改为 `maxUnavailable: 1`。

---

## 内存管理策略（32GB 紧张环境）

### 当前内存分布
```
Total: 32GB | Used: 22.6GB | Free: 9.2GB

k3d 集群:     5.2GB  (agent 2.95 + server 2.24)
Edge 浏览器:   1.7GB
LM Studio:     640MB
Docker 自身:   1.3GB
其他 Windows:  ~13GB
```

### 可安全关闭的组件
| 组件 | 释放内存 | 影响 |
|------|---------|------|
| Java services (auth + gateway) | ~800MB | 不影响 Node.js API/Landing |
| RabbitMQ | ~146MB | 不影响核心功能 |
| LM Studio | ~640MB | 外部应用，随时可关 |

### 不可关闭的组件
| 组件 | 原因 |
|------|------|
| Nacos (974MB) | Java 微服务强依赖 |
| Postgres (109MB) | API 数据库 |
| Redis (9MB) | 缓存 + 任务队列 |

### Monitoring stack 决策树
```
内存 > 15GB 可用? 
  ├── Yes → 部署 Loki + Grafana + Promtail (~1GB)
  ├── 12-15GB → 只部署 Loki + Promtail (~400MB)，AI 直接调 API
  └── < 12GB → 不部署任何可观测性组件，继续用 kubectl logs
```

---

## CI/CD 快速通道

### 本地构建 → 部署（不使用 GitHub Actions）
```bash
# 1. 构建
docker build -f apps/api/Dockerfile -t crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/agenthive-api:<tag> .

# 2. 推送
docker push <image>

# 3. 导入 k3d
k3d image import <image> -c agenthive-dev

# 4. 更新 deployment
kubectl set image deployment/api api=<image> -n agenthive

# 5. 等待 rollout
kubectl rollout status deployment/api -n agenthive
```

### 强制删除卡住的 Pod
```bash
kubectl delete pod <pod> -n agenthive --grace-period=0 --force
```

---

## 可观测性决策（AI Agent 视角）

### 当前最佳实践：kubectl logs
AI Agent 不需要 Grafana UI，直接用 kubectl 获取日志已足够：

```bash
# 看所有 API 错误
kubectl logs -l app.kubernetes.io/name=api -n agenthive --tail=100 | grep -i error

# 看特定时间段
kubectl logs <pod> -n agenthive --since=5m

# 跟踪实时日志
kubectl logs -f <pod> -n agenthive
```

### 何时需要 Loki
- 需要跨 Pod 聚合查询
- 需要按时间范围回溯（kubectl logs 只能看当前 buffer）
- 需要结构化过滤（LogQL）

### 最小可观测性栈（内存充裕时）
```
Loki (~300MB) + Promtail DaemonSet (~50MB) = ~350MB
AI 直接调用: curl "http://loki:3100/loki/api/v1/query_range?query=..."
不需要 Grafana。
```

---

## 检查清单（每次 coding 前）

- [ ] `kubectl get pods -n agenthive` — 所有 Pod 都 Running/Ready？
- [ ] `helm list -n agenthive` — release 状态是 deployed？
- [ ] API image 是否最新？`kubectl get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}'`
- [ ] 数据库 migration 是否全部通过？`kubectl logs <api-pod> -n agenthive | grep -i migration`
- [ ] 内存是否充裕？`kubectl top node` + Docker stats
