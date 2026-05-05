# AgentHive Cloud — Agent 协作规范 (Claude Code 版)

> 完整规范见项目根目录 `AGENT_COLLABORATION_SPEC.md`
> 本文件为 Claude Code 专用摘要。

## 系统架构

```
用户 → Nginx → API Gateway (Spring Cloud) → Node.js API / Java 微服务
                                           ↓
                                    PostgreSQL + Redis + Nacos + RabbitMQ
```

- **Node.js** (Express + TypeScript ESM): AI 控制平面、BFF、聊天、Agent 调度
- **Java** (Spring Boot 3.2): 事务性业务 — 用户、支付、订单、购物车、物流
- **前端** (Nuxt 3 + Vue 3): Landing 官网、Chat UI

## 不可违背的决策

1. 认证在 Gateway 层唯一收口 — 下游只认 `X-User-Id` header
2. Node.js 不做事务性业务
3. Java 承载所有高并发业务
4. Agent 任务必须异步化 (Redis Streams)
5. 统一 ID: UUIDv7 (历史遗留: Java 用 BIGINT, Node.js 用 UUID)

## 角色边界 (严格遵守)

作为 Claude Code，你可能被要求执行任何任务。但**必须遵守角色边界**：

- 如果你是 Frontend 角色 → 只修改 `apps/landing/`, `apps/web/`, `packages/ui/`
- 如果你是 Backend 角色 → 只修改 `apps/api/`, `packages/types/`
- 如果你是 Platform 角色 → 只修改 `chart/`, `k8s/`, `monitoring/`
- 如果你需要修改其他角色的代码 → 必须提交请求，不能擅自越界

## 编码规范

### TypeScript / Node.js
- ESM 模块 (`import/export`)，文件扩展名 `.js`
- `tsc --noEmit` 零错误才能提交
- 输入校验用 Zod 或手动校验
- 结构化 JSON 日志
- **UUID 校验**: 所有 session ID、project ID 必须经过 `isValidUuid()` 校验

### Vue 3 / Nuxt 3
- Composition API + `<script setup>`
- Pinia 组合式 Store
- Tailwind CSS + Element Plus
- SSR 安全: `onMounted` 中调用客户端 API

### PostgreSQL
- Migration 命名: `YYYYMMDDhhmmss_description.sql`
- **PG 16 陷阱**: 不支持 `ADD CONSTRAINT IF NOT EXISTS` → 用 `DO $$` 块
- JSONB 列防御: 字符串输入必须 `JSON.stringify([value])`
- 手动 ALTER 后必须同步 `_migrations` 表

## 已知问题 (踩坑记录)

1. **chat_sessions 唯一约束**: 每个 project_id 只能有一个 active session。创建前必须先查。
2. **tech_stack JSONB**: 前端传 `"react"` → 后端必须转 `["react"]` 才能存 JSONB。
3. **Helm Secret 模式**: 必须保留三种模式 (ExternalSecret / empty / Helm-managed)。
4. **k3d 单节点死锁**: `maxUnavailable: 0` 会导致滚动更新卡住 → 用 `1`。
5. **Migration 顺序**: 手动 ALTER 后忘记插 `_migrations` 记录会导致 node-pg-migrate 报错。

## 验证要求

任何声称"修复完成"之前，必须执行并展示：
1. 类型检查通过 (`tsc --noEmit`)
2. 新功能有单元测试且通过
3. 如果是 DB 变更 → 干净数据库全量 replay migration 通过
4. 如果是 Helm 变更 → `helm template` 渲染验证通过

## 快速命令

```bash
# 查看集群状态
kubectl get pods -n agenthive

# API 错误日志
kubectl logs -l app.kubernetes.io/name=api -n agenthive --tail=50 | grep -i error

# 数据库 migrations
kubectl exec <postgres-pod> -n agenthive -- psql -U agenthive -c "SELECT name FROM _migrations ORDER BY run_on;"

# 类型检查
cd apps/api && npx tsc --noEmit

# 本地 API 测试
kubectl port-forward deployment/api 3001:3001 -n agenthive
curl http://localhost:3001/api/health
```

## 参考文档

- 完整规范: `AGENT_COLLABORATION_SPEC.md`
- 运维手册: `docs/operation/runbook-k3s-ops.md`
- 架构总览: `docs/architecture/00-architecture-review.md`
- 数据库审计: `docs/database-architecture-audit.md`
