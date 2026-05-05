---
title: AgentHive Cloud — Agent 协作规范 v1.0
description: >
  当任何一个 AI Agent 接手 AgentHive Cloud 项目时，必须遵循的协作标准。
  涵盖编码规范、前后端协作、DevOps、QA 测试、知识沉淀，
  确保多 Agent 团队以同等质量持续交付。
---

# AgentHive Cloud — Agent 协作规范 v1.0

> **生效日期**: 2026-05-06  
> **适用范围**: 所有接入 AgentHive Cloud 项目的 AI Agent（Coding Agent、DevOps Agent、QA Agent、Platform Agent）  
> **状态**: 强制执行  
> **版本策略**: 每次重大架构变更或累计 5 条以上新教训时更新

---

## 1. 项目上下文与不可违背的架构决策

### 1.1 系统边界

```
用户请求
    │
    ▼
┌─────────┐    ┌─────────────┐    ┌─────────────────────────────┐
│  Nginx  │───→│ API Gateway │───→│ Java 微服务 (8080-8086)     │
│  :80/443│    │  :8080      │    │ • auth-service    :8081     │
└─────────┘    └──────┬──────┘    │ • user-service    :8082     │
                      │           │ • payment-service :8083     │
                      │           │ • order-service   :8084     │
                      ▼           │ • cart-service    :8085     │
              ┌─────────────┐     │ • logistics-service :8086   │
              │  Node API   │     └─────────────────────────────┘
              │  :3001      │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────────┐
    │Postgres│  │ Redis  │  │   Nacos    │
    └────────┘  └────────┘  └────────────┘
```

### 1.2 不可违背的架构决策 (Architecture Decision Records)

以下决策**没有任何 Agent 有权推翻**，如发现矛盾，必须升级给人类架构师：

| # | 决策 | 理由 | 违反后果 |
|---|------|------|---------|
| ADR-001 | **认证在 Gateway 层唯一收口** | 下游服务只认 `X-User-Id` header，不解析 JWT | 安全漏洞、跨服务鉴权失败 |
| ADR-002 | **Node.js = AI 控制平面 + BFF** | 不做事务性业务，那是 Java 的领域 | 重复造轮子、数据不一致 |
| ADR-003 | **Java = 企业级核心领域** | 承载所有事务性、高并发业务 | 性能瓶颈、并发安全问题 |
| ADR-004 | **Agent 任务必须异步化** | Redis Streams 队列，绝不直接 spawn | 资源耗尽、僵尸进程 |
| ADR-005 | **可观测性原生** | 所有服务必须接入 OTel | 线上故障无法定位 |
| ADR-006 | **统一 ID 策略 UUIDv7** | Java (BIGINT) 与 Node.js (UUID) 历史割裂，新系统统一用 UUIDv7 | 用户数据无法关联 |
| ADR-007 | **Database Per Service (Java)** / **共享数据库 (Node.js 过渡)** | Java 微服务各自独立数据库；Node.js 逐步拆分 | 数据耦合、schema 冲突 |

### 1.3 技术栈契约

| 层级 | 技术 | 版本 | Agent 操作权限 |
|------|------|------|---------------|
| 前端 | Nuxt 3 + Vue 3 + Element Plus + Tailwind | 3.11+ | Frontend Agent 可写 |
| API 网关 | Spring Cloud Gateway | 2023.0.5 | Platform Agent 可写 |
| 注册中心 | Nacos | 2.x | Platform Agent 可写 |
| Node.js | Express + TypeScript ESM | Node 20 / TS 5.4+ | Backend Agent 可写 |
| Java | Spring Boot 3.2 + Spring Cloud Alibaba | 3.2.12 | Backend Agent 可写 |
| 数据库 | PostgreSQL 16 | 16 | Backend Agent 可写 (migration) |
| 缓存 | Redis 7 | 7 | Platform Agent 可写 |
| 消息队列 | RabbitMQ 3.13 | 3.13 | Platform Agent 可写 |
| 容器编排 | Kubernetes (k3d 开发) / ACK (生产) | 1.30+ | Platform Agent 可写 |
| 部署 | Helm 3 | 3.x | Platform Agent 可写 |

---

## 2. Agent 角色与权限边界 (RBAC)

### 2.1 角色定义

| 角色 | 职责范围 | 可写目录 | 不可写目录 (HARD GATE) |
|------|---------|---------|----------------------|
| **Lead (阿黄)** | 需求拆解、任务分配、质量审查、架构决策 | `.kimi/`, `docs/`, `AGENTS/` | `apps/`, `chart/`, `k8s/`, `scripts/` |
| **Frontend Dev (小花)** | Vue 3/Nuxt 3 组件、页面、样式、Pinia Store | `apps/landing/`, `apps/web/`, `packages/ui/` | 后端代码、Dockerfile、CI/CD、DB migration |
| **Backend Dev (阿铁)** | Express API、Service、DB Schema、TypeScript 类型 | `apps/api/`, `apps/agent-runtime/`, `packages/types/` | 前端代码、K8s 资源、Terraform |
| **QA Engineer (阿镜)** | 测试用例、代码审查、回归验证 | `apps/*/tests/`, `tests/` | 生产代码 (read-only review) |
| **Platform Engineer** | K8s/Helm、Terraform、CI/CD、可观测性 | `chart/`, `k8s/`, `iac/`, `monitoring/`, `scripts/` | 业务逻辑代码 |

### 2.2 跨角色协作规则

```
Frontend Dev 需要后端 API 变更?
    └── 必须提交 TICKET → Lead 审批 → Backend Dev 执行
    └── 禁止 Frontend Dev 直接修改 apps/api/src/

Backend Dev 需要前端界面调整?
    └── 必须提交 TICKET → Lead 审批 → Frontend Dev 执行
    └── 禁止 Backend Dev 直接修改 apps/landing/

任何 Agent 发现架构决策矛盾?
    └── 标记为 [ESCALATE] → Lead 评估 → 人类架构师裁决
```

---

## 3. 协作协议：TICKET → RESPONSE → REVIEW

### 3.1 TICKET 规范 (任务单)

每个任务必须有 TICKET。没有 TICKET 的代码修改视为违规。

```yaml
# .kimi/tickets/TICKET-{DOMAIN}-{NNN}.yaml

ticket_id: TICKET-BACKEND-042
title: "修复创建项目时 tech_stack JSONB 类型错误"
type: bugfix              # feature | bugfix | refactor | docs | security
priority: P1              # P0=线上故障 P1=功能阻塞 P2=体验问题 P3=优化
status: in_progress       # pending | in_progress | completed | approved | blocked
role: backend_dev         # frontend_dev | backend_dev | qa_engineer | platform

# 问题描述
description: |
  前端 dashboard.vue 创建项目时传 techStack: 'react' (字符串)，
  但数据库 projects.tech_stack 是 JSONB 类型。
  PostgreSQL 报错: invalid input syntax for type json (22P02)。

# 验收标准 (必须可验证)
acceptance_criteria:
  - AC1: 传入字符串 "react" 时，数据库存储为 ["react"]
  - AC2: 传入 null/undefined 时，数据库使用默认值 '[]'
  - AC3: 传入数组 ["react", "vue"] 时，正确序列化
  - AC4: 现有测试全部通过
  - AC5: TypeScript 编译通过

# 相关文件
relevant_files:
  - apps/api/src/project/service.ts
  - apps/landing/pages/dashboard.vue

# 约束条件
constraints:
  - 不能破坏现有项目查询接口
  - 不能修改数据库列类型
  - 保持向前兼容

# 依赖
depends_on: []

# 风险评估
risk_assessment: low      # low | medium | high
security_implications: none  # review_required | none
```

### 3.2 RESPONSE 规范 (执行报告)

任务完成后，执行 Agent 必须提交 RESPONSE。

```yaml
# .kimi/tickets/RESPONSE-TICKET-BACKEND-042.yaml

ticket_id: TICKET-BACKEND-042
status: completed          # completed | blocked | needs_review

# 客观评分 (必须基于实际验证，不能自评)
objective_breakdown:
  acceptance_criteria: { score: 0.25, note: "4/4 AC 全部通过" }
  compile_passed:      { score: 0.10, note: "tsc --noEmit 0 errors" }
  test_coverage:       { score: 0.15, note: "新增 normalizeTechStack 单元测试" }
  security_scan:       { score: 0.10, note: "无新增 secret、无 SQL 注入风险" }
  code_style:          { score: 0.10, note: "符合项目 ESM/TS 规范" }
  documentation:       { score: 0.05, note: "函数注释完整" }
  # 总分 = 0.75

# 执行摘要
summary: |
  在 project/service.ts 中添加 normalizeTechStack() 函数，
  将字符串包装为 JSON 数组，数组直接 JSON.stringify()，
  null/undefined/空字符串转为 null。

files_modified:
  - apps/api/src/project/service.ts

verification_status:
  self_review_passed: true
  tests_added: true
  tests_passed: true
  type_check_passed: true

# 经验教训 (必须填写，用于知识沉淀)
learnings: |
  前端传字符串、后端存 JSONB 时，后端必须做防御性转换。
  不要假设前端会传正确的类型。

skill_candidate: true
skill_summary: "JSONB 列防御性转换模式：normalizeJsonbColumn()"
```

### 3.3 REVIEW 规范 (审查报告)

Lead 或 QA 审查后必须提交 REVIEW。

```yaml
# .kimi/tickets/REVIEW-TICKET-BACKEND-042.yaml

ticket_id: TICKET-BACKEND-042
reviewer: lead
review_decision: approved    # approved | needs_revision | rejected
review_score: 0.85

issues: []                   # 如有问题，列文件:行号和修复建议

verdict: |
  修复方案正确，normalizeTechStack() 覆盖了字符串/数组/null 三种情况。
  建议：将类似转换抽象为通用工具函数，供其他 JSONB 列复用。

next_action: none            # "Specialist fixes X" or "none"
```

### 3.4 置信度路由规则

| 客观评分 | 处理流程 |
|---------|---------|
| 0.90-1.00 | 快速审查 (spot-check)，通过后自动合并 |
| 0.75-0.89 | 标准审查 (逐项验证) |
| 0.60-0.74 | 详细审查 + 可能要求补充测试/文档 |
| < 0.60 | 退回重派，附带具体改进要求 |

---

## 4. 编码规范

### 4.1 通用规范

| 规则 | 说明 | 违规示例 |
|------|------|---------|
| **UTF-8 with BOM** | Windows 环境强制要求 | ❌ 无 BOM 文件 |
| **ES2022 / TypeScript 5.4+** | 所有应用目标 | ❌ 使用旧语法 |
| **ESM 模块** | `import/export`，禁止 `require` | ❌ 混用 CommonJS |
| **Commit 规范** | `type(scope): description`（英文） | ❌ "修改bug" |
| **Git Flow** | main / develop / feature/* | ❌ 直接在 develop 提交 |

### 4.2 前端规范 (Landing/Web)

```typescript
// ✅ 正确：Composition API + <script setup>
<script setup lang="ts">
import { ref, computed } from 'vue'

const items = ref<any[]>([])
const count = computed(() => items.value.length)
</script>

// ✅ 正确：Pinia 组合式 Store
export const useExampleStore = defineStore('example', () => {
  const items = ref<any[]>([])
  const count = computed(() => items.value.length)
  return { items, count }
})

// ✅ 正确：SSR 安全代码
const isClient = ref(false)
onMounted(() => { isClient.value = true })

// ❌ 错误：客户端 API 在 setup 中直接调用
const token = localStorage.getItem('token')  // 会 hydration mismatch
```

**组件命名**: PascalCase (`AgentTracker.vue`)
**组合式函数**: `use` 前缀 (`useAgentTracker.ts`)
**样式**: Tailwind CSS + Element Plus，禁止内联样式

### 4.3 后端规范 (API)

```typescript
// ✅ 正确：Express + TypeScript ESM
import { Router } from 'express'
import { isValidUuid } from '../utils/validators.js'

// ✅ 正确：UUID 防御性校验
const { id } = req.params
if (!isValidUuid(id)) {
  return res.status(400).json({
    code: 400,
    message: `会话 ID 格式错误: "${id}" 不是有效的 UUID`,
    data: null
  })
}

// ✅ 正确：Zod 或手动输入校验
// ❌ 错误：直接信任前端输入插入 SQL
```

**路由**: 按功能模块分离
**错误处理**: 统一错误中间件
**验证**: Zod 或类似库进行输入验证
**日志**: 结构化 JSON 日志 (winston/pino)

### 4.4 数据库规范

```sql
-- ✅ 正确：migration 命名
-- 20260506120000_add-column-to-table.sql

-- ✅ 正确：PG 16 兼容的约束添加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_example'
  ) THEN
    ALTER TABLE example ADD CONSTRAINT uq_example UNIQUE (col);
  END IF;
END $$;

-- ❌ 错误：PG 16 不支持此语法
-- ALTER TABLE example ADD CONSTRAINT IF NOT EXISTS uq_example UNIQUE (col);
```

**Migration 规则**:
1. 命名：`YYYYMMDDhhmmss_description.sql`
2. 必须包含 `up` 和 `down` 迁移
3. **PG 16 不支持 `ADD CONSTRAINT IF NOT EXISTS`** → 用 `DO $$` 块
4. 每次新 migration 必须在**干净数据库**上全量测试
5. 手动 `ALTER TABLE` 后必须同步 `_migrations` 表记录
6. **12 条现有 migration 是历史记录**，不可修改

**数据类型陷阱**:
| 前端传 | 数据库列 | 必须转换 |
|--------|---------|---------|
| `string` | `JSONB` | `JSON.stringify([value])` |
| `string` | `UUID` | 校验 RFC 4122 格式 |
| `undefined` | `TIMESTAMPTZ` | `DEFAULT NOW()` |

---

## 5. 质量门禁 (Definition of Done)

任何代码合并前必须通过以下检查。Agent 必须在 RESPONSE 中提供验证证据。

### 5.1 强制检查项

- [ ] **类型检查通过**: `cd apps/api && npx tsc --noEmit` (Node.js) / `mvn compile` (Java)
- [ ] **代码风格**: ESLint/Prettier 无错误
- [ ] **新功能有测试**: 单元测试覆盖核心逻辑
- [ ] **现有测试全过**: `npm run test` / `mvn test`
- [ ] **无安全漏洞**: 无硬编码 secret、无 SQL 注入、无 XSS
- [ ] **数据库兼容**: 新 migration 在干净 DB 全量通过

### 5.2 推荐检查项

- [ ] **E2E 测试**: Playwright 关键路径通过
- [ ] **性能基准**: 新 API 响应时间 < 500ms (P95)
- [ ] **文档更新**: README / API 文档同步更新
- [ ] **CHANGELOG**: 用户可见变更记录

### 5.3 验证铁律

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

1. IDENTIFY: 什么命令能证明这个声明？
2. RUN:     执行完整命令（不是节选）
3. READ:    读取完整输出，检查 exit code
4. VERIFY:  输出是否确认声明？
5. ONLY THEN: 做出声明
```

**反例** (前session中发生的真实错误):
- ❌ "migration 已修复" → 未在干净 DB 验证，结果 PG 16 语法错误
- ❌ "Helm 已修复" → 未渲染模板验证，结果 prod values 降配
- ❌ "Secret 已恢复" → 未检查 dev 环境，结果 app-secrets 缺失

---

## 6. 前后端协作规范

### 6.1 API 契约

```typescript
// 统一响应格式
interface ApiResponse<T> {
  code: number        // 200=成功, 400=客户端错误, 500=服务端错误, 6000+=AI业务错误
  message: string     // 人类可读描述
  data: T | null      // 业务数据
}

// 错误码范围
// 200-299: 成功
// 400-499: 客户端错误
// 500-599: 服务端错误
// 6000-6999: AI Agent 业务错误
// 7000-7999: 电商业务错误
```

### 6.2 类型同步

| 规则 | 说明 |
|------|------|
| **Source of Truth** | `packages/types/` 是共享类型的唯一来源 |
| **前端不可自行定义后端类型** | 必须 import 共享类型 |
| **后端变更类型 → 必须通知前端** | 通过 TICKET 流程 |
| **ID 类型统一** | 全部使用 `string` (UUID)，禁止前端生成 `conv-${Date.now()}` |

### 6.3 数据类型转换矩阵

| 场景 | 前端传 | 后端接 | 数据库存储 | 必须处理 |
|------|--------|--------|-----------|---------|
| 技术栈 | `"react"` | `string` | `JSONB` | ✅ 后端 `JSON.stringify([value])` |
| 会话ID | `"conv-123"` | `string` | `UUID` | ❌ 前端必须传合法 UUID |
| 创建时间 | `Date` 对象 | `string` | `TIMESTAMPTZ` | ✅ 后端 `new Date()` |
| 布尔值 | `true` | `boolean` | `BOOLEAN` | ✅ 直接传递 |
| 枚举 | `"active"` | `string` | `VARCHAR + CHECK` | ✅ 后端校验 CHECK 约束 |

### 6.4 Mock 数据政策

| 环境 | 策略 |
|------|------|
| **开发** | 后端优先，前端 catch 块**禁止**生成 mock fallback |
| **测试** | 使用 MSW / 专用测试数据库 |
| **生产** | 绝对禁止 mock，所有错误必须抛给上层 |

**前session教训**: `landing/stores/chat.ts` 的 catch 块生成 `conv-${Date.now()}` 假 ID，导致后端 UUID 校验失败。已删除所有 catch-block mock fallback。

---

## 7. DevOps 规范

### 7.1 开发环境 (k3d)

```bash
# 内存分布 (32GB 主机)
# k3d 集群:     5.2GB (agent 2.95 + server 2.24)
# Edge 浏览器:   1.7GB
# Docker 自身:   1.3GB
# 可用:          ~9GB

# 可安全关闭 (不影响 Node.js API):
kubectl scale deployment auth-service gateway-service --replicas=0 -n agenthive   # 省 800MB
kubectl scale deployment rabbitmq --replicas=0 -n agenthive                        # 省 146MB

# 不可关闭 (强依赖):
# nacos (Java 服务注册发现)
# postgres (API 数据库)
# redis (缓存 + 任务队列)
```

### 7.2 CI/CD 快速通道 (本地紧急修复)

```bash
# 1. 构建 (从项目根目录)
docker build -f apps/api/Dockerfile \
  -t crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/agenthive-api:<tag> .

# 2. 推送
docker push <image>

# 3. 导入 k3d
k3d image import <image> -c agenthive-dev

# 4. 更新 deployment
kubectl set image deployment/api api=<image> -n agenthive

# 5. 等待 rollout
kubectl rollout status deployment/api -n agenthive
```

### 7.3 Helm 陷阱清单

| 陷阱 | 症状 | 修复 |
|------|------|------|
| **image 名称不匹配** | `ErrImagePull` | 统一为 `namespace-alpha/agenthive-api` |
| **prod values 被降配** | replicas=1, HPA disabled | 恢复 replicas=3, HPA/PDB enabled |
| **registry secret 硬编码** | 安全风险 | `registry.enabled: false`，用 node-level |
| **maxUnavailable: 0** | 单节点死锁 | 默认值改为 `maxUnavailable: 1` |
| **Helm pending-upgrade** | `another operation is in progress` | `helm rollback` 后重试 |
| **Secret 模式断裂** | `app-secrets not found` | 保留三种模式：ExternalSecret / empty / Helm-managed |

### 7.4 可观测性决策树

```
内存 > 15GB 可用?
  ├── Yes → 部署 Loki + Grafana + Promtail (~1GB)
  ├── 12-15GB → 只部署 Loki + Promtail (~400MB)，AI 直接调 API
  └── < 12GB → 不部署，继续用 kubectl logs

AI Agent 视角：kubectl logs 已足够
  kubectl logs -l app.kubernetes.io/name=api -n agenthive --tail=100 | grep -i error
```

---

## 8. QA 测试规范

### 8.1 测试金字塔

```
        ┌─────────┐
        │   E2E   │  Playwright (关键路径)
        │  ~10%   │
       ┌┴─────────┴┐
       │ Integration │  Supertest / REST Assured
       │   ~30%    │
      ┌┴───────────┴┐
      │    Unit     │  Vitest / JUnit (核心业务逻辑)
      │    ~60%     │
      └─────────────┘
```

### 8.2 关键测试路径 (必须覆盖)

```
Chat → Agent 完整流程:
1. 用户访问 /chat
2. 登录 (或访客)
3. 发送: "创建一个 TODO 应用"
4. 验证:
   - Chat API 返回 200
   - 意图识别为 "create_project"
   - 不返回 mock fallback ID
   - Session ID 是合法 UUID
   - WebSocket 推送进度
   - 最终返回可运行代码

电商完整流程:
1. 注册 → JWT
2. 加购 → Cart Service
3. 结算 → Order Service
4. 支付 → Payment Service → 钱包扣款
5. 发货 → Logistics Service
6. 验证: 状态变更、MQ 投递、数据一致性
```

### 8.3 回归测试要求

- 修改数据库 schema → 必须在**干净 DB** 上全量 replay migration
- 修改 API 接口 → 必须更新对应测试 + 前端类型
- 修改共享库 → 必须跑所有依赖项目的测试

---

## 9. 知识沉淀与 Skill 管理

### 9.1 沉淀触发条件 (MVMP)

以下任一条件触发强制 skill draft：
1. 同一问题模式被 ≥2 个 TICKET 遇到
2. 单个 TICKET 调试消耗 >10K tokens
3. Agent 主动标记 `skill_candidate: true`

### 9.2 Skill 质量门

```markdown
# Skill 必须包含：

## 何时使用
具体场景描述，让其他 Agent 知道是否匹配

## 代码示例
复制即可使用的代码片段

## 陷阱
边界条件、常见错误、已踩过的坑

## 来源
可追溯的 TICKET ID 和文件路径
```

### 9.3 Skill 生命周期

| 状态 | 规则 |
|------|------|
| **Draft** | 30 天内被引用 ≥1 次 → Promote |
| **Official** | 纳入 `.agents/skills/` 目录 |
| **Extended** | 30 天零引用但有长期价值 → 延长 60 天观察 |
| **Archived** | 技术栈升级导致过时 |
| **Deleted** | 零引用且无长期价值 |

---

## 10. 反模式与禁忌 (FORBIDDEN)

### 10.1 编码禁忌

| # | 禁忌 | 后果 | 正确做法 |
|---|------|------|---------|
| F-001 | 前端 catch 块生成 mock fallback | 前后端数据不一致、调试困难 | catch 块 throw err，让上层处理 |
| F-002 | 直接信任前端输入插入 SQL | SQL 注入 | 参数化查询 + Zod 校验 |
| F-003 | 混用 ESM / CommonJS | 构建错误、运行时异常 | 统一 ESM，`.js` 扩展名 |
| F-004 | 修改已执行的 migration | 数据库状态混乱 | 新增 migration 修复 |
| F-005 | 跳过类型检查提交 | 运行时 TypeError | `tsc --noEmit` 必须通过 |
| F-006 | 硬编码 secret / API Key | 安全漏洞 | 使用环境变量或 K8s Secret |
| F-007 | Agent 修改非职责范围代码 | 架构腐化、权限混乱 | 提交 TICKET 给正确角色 |
| F-008 | 高置信度但无验证 | 幻觉、回归故障 | 客观评分 + 验证证据 |
| F-009 | 忽略架构决策记录 | 技术债务积累 | 矛盾时标记 [ESCALATE] |
| F-010 | 跨技术栈直接操作数据库 | 数据不一致、耦合 | 通过 API Gateway 调用 |

### 10.2 协作禁忌

- ❌ **Siloed execution**: 不读相关代码就修改
- ❌ **Silent failure**: 返回 "completed" 但无验证
- ❌ **Memory hoarding**: 不写 reflections、不沉淀 skills
- ❌ **Performative agreement**: "你说得对" → 用技术重述代替
- ❌ **Blind implementation**: 不验证就实现 review feedback
- ❌ **Lead overreach**: Lead 直接写业务代码 (HARD GATE)

---

## 11. 附录：快速参考

### 11.1 一键诊断

```bash
# 集群状态快照
kubectl get pods -n agenthive
helm list -n agenthive
kubectl top pod -n agenthive

# API 错误定位
kubectl logs -l app.kubernetes.io/name=api -n agenthive --tail=50 | grep -i error

# DB 检查
kubectl exec postgres-xxx -n agenthive -- psql -U agenthive -c "SELECT name FROM _migrations ORDER BY run_on;"

# 本地测试
kubectl port-forward deployment/api 3001:3001 -n agenthive
curl http://localhost:3001/api/health
```

### 11.2 紧急操作

```bash
# Helm 卡住
helm rollback agenthive-dev <rev> -n agenthive
kubectl delete job -l app.kubernetes.io/managed-by=Helm -n agenthive

# Pod 卡住
kubectl delete pod <pod> -n agenthive --grace-period=0 --force

# 回滚 deployment
kubectl rollout undo deployment/api -n agenthive
```

### 11.3 文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 架构总览 | `docs/architecture/00-architecture-review.md` | 系统边界、技术栈 |
| 快速参考 | `docs/reference/quick-reference.md` | 命令速查 |
| 运维手册 | `docs/operation/runbook-k3s-ops.md` | K8s 故障排查 |
| Helm 差距 | `docs/deployment/helm/helm-migration-gaps.md` | 环境变量映射 |
| 数据库审计 | `docs/database-architecture-audit.md` | Java/Node 数据契约 |
| 开发运维 | `.agents/skills/agenthive-dev-operations/SKILL.md` | 实战踩坑记录 |
| 本规范 | `AGENT_COLLABORATION_SPEC.md` | **你正在读的** |

---

> **最后更新**: 2026-05-06  
> **维护者**: AgentHive Platform Team  
> **变更记录**: 见 Git commit `7376b01` 及后续
