# 2026-05-06 日结：修复总结、方案记录与分支同步状态

> 记录人：Kimi Agent  
> 日期：2026-05-06  
> 范围：prod 故障修复、架构方案讨论、分支同步差距

---

## 一、今日 prod 故障修复总结

### 1.1 持久化修复（已提交到 git，集群重建后保留）

| Commit | 类型 | 文件 | 说明 | 分支 |
|--------|------|------|------|------|
| `3d8b436` | API 代码 | `apps/api/src/services/llm.ts`<br>`apps/api/src/chat-controller/service.ts` | LLM fetch 超时修复：AbortController + 25s 默认超时。`classifyIntent` 8s，`generateReply` 18s + maxTokens 2048→1024 | **develop** |
| `57b9196` | API 代码 | `apps/api/src/config/cors.ts`<br>`apps/api/src/websocket/hub.ts`<br>`chart/agenthive/values.prod.yaml` | CORS origin parsing 修复 + 添加 `www.xiaochaitian.asia` 到允许域名 | **master** |
| `f277eb8` | Helm | `chart/agenthive/values.yaml` | REDIS_HOST/REDIS_PORT 从 `envFromSecret` 移到 `api.envFromConfigMap` | **develop** |
| `70c2a8f` | Helm | `chart/agenthive/values.yaml` | REDIS_HOST/REDIS_PORT 添加到 api envFromConfigMap（master 版本） | **master** |
| `c4be690`<br>`f5877e2` | Helm | `chart/agenthive/values.yaml` | LLM_USER_AGENT 修正为 `claude-code/0.1.0` | **master** |
| `6da5486` | Helm | `chart/agenthive/values.yaml` | CPU 资源优化（单节点集群） | **master** |
| `27a777d` | Helm | `chart/agenthive/values.yaml` | ArgoCD sync 修复：nacos pvc storageClass，disable otelCollector | **master** |
| `41d64ab` | Helm | `chart/agenthive/values.prod.yaml`<br>`templates/api-deployment.yaml`<br>`templates/java-deployment.yaml` | Prod ConfigMap keys 恢复、Redis host 修复、域名更新为 xiaochaitian.asia、disable agent-runtime | **master** |
| `f4f1085` | Helm | `chart/agenthive/values.yaml` | Disable redis deployment，使用外部 Redis | **master** |
| `56c4c3e` | Helm | `chart/agenthive/values.yaml` | Disable NetworkPolicy（外部 DB/Redis 访问需要） | **master** |
| `aabcf11` | Helm | `chart/agenthive/values.yaml` | Remove ingress configuration-snippet（被 nginx admin 禁用） | **master** |
| `f20506b` | Helm | `chart/agenthive/values.yaml` | 使用 api:latest tag + 添加 acr-regcred imagePullSecret | **master** |
| `387cd18` | DB Migration | `apps/api/src/db/migrations/20260423000000_init.sql` | Add `IF NOT EXISTS` for owner_id/project_id columns | **master** |
| `c21df13` | DB Migration | `apps/api/src/db/migrations/20260505000000_schema-alignment.sql` | Replace `ADD CONSTRAINT IF NOT EXISTS` with DO block for PostgreSQL compat | **master** |
| `c183b4c` | 功能 | `apps/api/src/chat-controller/service.ts`<br>`apps/landing/components/chat/*` | Chat 专业回复：结构化 thinking + 多消息类型 UI | **master** |
| `9840356` | 修复 | `apps/landing/components/chat/*` | Fix undefined setSessionId + 缺失组件导入 | **master** |
| `135dfbe` | 修复 | `apps/api/src/project/service.ts` | Normalize tech_stack to valid JSONB before insert/update | **master** |
| `d435c85` | Helm | `chart/agenthive/values.yaml` | Restore production config after ArgoCD-Helm switch | **master** |

### 1.2 临时修复（集群操作，重建/迁移后丢失）

| 操作 | 位置 | 说明 | 是否已代码化 |
|------|------|------|-------------|
| 手动删除 migration 记录 | PostgreSQL `_migrations` 表 | 删除乱序记录 `20260505000100_add-repo-url-to-projects`，恢复 Helm upgrade | ❌ 未代码化。需删除该 migration 文件或调整顺序 |
| Helm upgrade develop (rev 30) | develop k3d 集群 | `helm upgrade agenthive chart/agenthive -n default -f values.dev.yaml` | ⚠️ 镜像 tag 在 CI 中，values 在 git 中，但 upgrade 命令本身不是代码 |
| Mock LLM server 部署 | develop k3d 集群 | sleep-30s mock server 用于验证超时逻辑 | ❌ 临时部署，应已删除 |
| DB 连接修复验证 | develop 集群 | API Pod 确认 DB/Redis Connected | N/A |

---

## 二、分支同步状态：master ↔ develop

### 2.1 develop 有、master 没有（需要 cherry-pick 到 master）

```
develop 独有：
  3d8b436 fix(api): add LLM fetch timeout to prevent 40s+ hangs
  f277eb8 fix(helm): add REDIS_HOST/REDIS_PORT to api.envFromConfigMap
```

- **`3d8b436` LLM 超时修复**：这是今天最关键的代码修复。master/prod 目前**没有**这个修复，prod 的 LLM 调用仍有 40s+ 挂死风险。
- **`f277eb8` Redis 配置修复**：develop 把 REDIS_HOST/REDIS_PORT 从 `envFromSecret` 移到了 `envFromConfigMap`。master 有类似的修复（`70c2a8f`）但位置不同，需要确认是否冲突。

### 2.2 master 有、develop 没有（需要同步到 develop）

```
master 独有：
  57b9196 fix(api): CORS origin parsing for Socket.io + add www.xiaochaitian.asia
  c21df13 fix(db): replace ADD CONSTRAINT IF NOT EXISTS with DO block
  c4be690 fix(chart): correct LLM_USER_AGENT to claude-code/0.1.0
  f5877e2 fix(chart): restore LLM_USER_AGENT to Claude-Code/1.0
  6da5486 fix(chart): optimize CPU resources for single-node cluster
  27a777d fix(chart): resolve ArgoCD sync failures
```

- **`57b9196` CORS 修复**：prod 已修复 Socket.io CORS 和域名。develop 没有，dev 环境可能仍有 CORS 问题。
- **`c21df13` Migration 修复**：PostgreSQL 兼容性修复。develop 没有，如果 develop 跑 migration 可能遇到同样的问题。
- **`c4be690`/`f5877e2` LLM_USER_AGENT**：prod 已修正为 `claude-code/0.1.0`。develop 没有这个修复，如果 develop 的 LLM 调用用了错误的 User-Agent，可能被 Kimi API 拒绝。
- **`6da5486` CPU 资源优化**：单节点集群资源限制。develop 没有，可能导致 dev 集群资源不足。
- **`27a777d` ArgoCD sync 修复**：nacos pvc storageClass + disable otelCollector。develop 没有，如果 develop 启用了这些组件可能遇到同样问题。

### 2.3 同步建议

**下一步操作：**

```bash
# 1. 把 develop 的 LLM 超时修复同步到 master（最关键）
git checkout master
git cherry-pick 3d8b436

# 2. 把 master 的 CORS + migration 修复同步到 develop
git checkout develop
git cherry-pick 57b9196
git cherry-pick c21df13

# 3. 合并其余 helm 配置差异
# 手动对比 values.yaml 中 LLM_USER_AGENT、CPU resources、ArgoCD 相关的差异
```

---

## 三、今日架构方案讨论记录（待完成 Feature）

### 3.1 产品定位重构

| 议题 | 结论 | 状态 |
|------|------|------|
| 目标用户 | 业务/设计用户（非资深开发者） | ✅ 已决策 |
| 交互形态 | 从 Chat-first 转向"画布 + 实时预览" | ✅ 已决策 |
| 对标产品 | atoms.dev | ✅ 已决策 |
| 后端策略 | 单体应用优先，不搞分布式微服务 | ✅ 已决策 |

### 3.2 Agent 角色架构

| 议题 | 结论 | 状态 |
|------|------|------|
| 角色模型 | Web 层用统一进程内的 Persona 切换（不是独立进程） | ✅ 已决策 |
| 上下文隔离 | 每个角色独立的 SubAgent + 独立的 ConversationContextV2 | ✅ 已决策 |
| 角色分工 | PM → Team Lead → Frontend Engineer → QA | ✅ 已决策 |
| Prompt 管理 | 统一从 `.md` 文件加载，运行时动态注入参数 | ✅ 已决策 |

### 3.3 基础闭环流程（待实现）

```
用户输入需求
  └── PM 阿黄: planPhase()
        └── 输出 feature list (todo list) → recommend 消息
              └── 用户确认/编辑/增删 todo list
                    └── Team Lead 确认 → 进入代码生成
                          └── Frontend Engineer 小花: 逐项生成代码
                                ├── 写入 workspace（文件系统）
                                ├── WebSocket 实时广播 file:created/file:updated
                                └── 用户实时看到文件树增长 + 代码打字机效果
```

### 3.4 文件存储方案（待决策/实现）

| 方案 | 成本 | 改动量 | 适用阶段 | 当前倾向 |
|------|------|--------|---------|---------|
| hostPath（单节点） | ¥0 | 极小 | MVP 最快落地 | **⭐ 推荐当前采用** |
| PVC（RWO） | ¥20-40/月 | 小 | 单 replica 持久化 | 备选 |
| 数据库 | ¥0 | 中 | API 无状态化 | 中长期考虑 |
| 自建 MinIO | ¥20-50+/月 | 大 | 大文件存储 | 暂不采用 |

**当前建议：hostPath**
- 单节点 k3s/k3d 天然支持
- 零成本
- 代码直接可运行（不需要导出）
- 改动量最小（values.yaml 改一行）

**风险：** 节点故障数据丢。需要定期 rsync 备份。

### 3.5 待完成 Feature 列表

| # | Feature | 优先级 | 预估工作量 | 依赖 |
|---|---------|--------|-----------|------|
| F-001 | **workspace 持久化**：将 emptyDir 改为 hostPath/PVC | P0 | 0.5 天 | 无 |
| F-002 | **分支同步**：master ↔ develop 双向 cherry-pick | P0 | 0.5 天 | 无 |
| F-003 | **Agent 角色分化**：PM/Team Lead/Engineer 独立 persona | P1 | 2 天 | F-004 |
| F-004 | **Prompt 文件化**：从 .md 加载，动态注入参数 | P1 | 1 天 | 无 |
| F-005 | **Plan Phase**：LLM 拆解需求为 feature list | P1 | 2 天 | F-004 |
| F-006 | **TodoList 组件**：前端可编辑的 feature list UI | P1 | 1 天 | F-005 |
| F-007 | **代码生成引擎**：替换 task-executor stub，真实 LLM 调用 | P0 | 3 天 | F-001, F-004 |
| F-008 | **实时文件同步**：WebSocket 广播 file:created/updated | P1 | 1 天 | F-007 |
| F-009 | **代码打字机效果**：Monaco Editor 接入或逐字 append | P2 | 1 天 | F-008 |
| F-010 | **预览服务**：独立 Pod，npm run dev，iframe 加载 | P1 | 2 天 | F-007 |

---

## 四、遗留问题

1. **DB migration `20260505000100_add-repo-url-to-projects`**：该 migration 文件时间戳乱序，导致 `node-pg-migrate` 严格检查失败。当前 workaround 是手动删除 `_migrations` 表记录。**需要决定**：删除该文件？还是调整时间戳重新排序？

2. **Java CI/CD 构建失败**：`target/` 目录问题，auth-service/gateway-service/landing 出现 `ErrImagePull`。需要单独排查。

3. **LLM stub 未清理**：`apps/agent-runtime/src/services/task-executor.ts` 中 `CodeGenerationExecutor` 等仍为 `delay(1000)` 假数据。

4. **Multi-Agent Orchestrator 未接入 Web**：`AGENTS/orchestrator.ts` 仅在 CLI 层运行，Web 用户无法使用。

---

*本文档为内部同步用，随开发进度更新。*
