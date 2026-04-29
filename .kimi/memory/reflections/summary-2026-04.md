# Reflection Summary: 2026-04

> Generated on 2026-04-27
> Compressed from 22 reflections (~38K tokens) → this summary (~2K tokens)
> Original files archived to: `.kimi/memory/archive/reflections/2026-04/`

---

## High-Frequency Patterns（出现 2+ 次）

### 1. Schema 变更与数据迁移
- 多个 Ticket 涉及数据库 schema 变更（FEAT-001a/b/c, JAVA-004, JAVA-006）
- 模式：先改 schema → 再改代码 → 最后验证，不可逆向
- Skill 候选: `java/patterns/schema-migration.md`

### 2. 统一错误处理
- FEAT-001a/b: 应用层业务错误需包装为统一 JSON 响应
- JAVA-004/006: Java 侧使用 `BusinessException` + 全局处理器
- Node 侧使用 `AppError` 类 + Zod 校验
- Skill 候选: 各角色 `patterns/error-handling.md`（已存在，需验证实战覆盖度）

### 3. 权限管理（RBAC + API 鉴权）
- FEAT-001b: 权限控制返回值模式（禁止/允许/自定义）
- JAVA-001/004: Credits 账户操作需用户级权限校验
- P0-001: 移除默认密码 fallback，强制环境变量注入

### 4. 前端性能优化
- FEAT-005a: Vue 3 `computed` 缓存优化列表渲染
- FEAT-006b: Monaco Editor 动态导入（~40MB → 按需加载）
- FEAT-006c: 拖拽实现使用原生 HTML5 API，避免库依赖
- Skill 候选: `frontend/patterns/performance-optimization.md`（已存在，已充实）

### 5. Docker/K8s 配置一致性
- MON-1/MON-2: Dev 与 Prod 配置对齐（Redis 持久化、JVM 参数、网络名）
- P0-DEV-001: nginx upstream 主机名不一致、环境变量缺失、数据库 schema 未初始化
- Skill 候选: `platform/patterns/dev-prod-config-separation.md`（draft 状态，待考察）

---

## One-Time Insights（高价值单次教训）

| Ticket | Insight |
|--------|---------|
| FEAT-002a | `fs.exists` 是 callback 风格，误用 async/await 导致"文件不存在"误判 |
| FEAT-002a | multer 默认上传目录在 Express 中间件之后，需自定义错误处理 |
| FEAT-005a | `nuxt typecheck` 历史错误被本次 Ticket 引入，需先清理再开发 |
| FEAT-006a | Document 图谱查询需维护双向引用，避免孤儿节点 |
| FEAT-006b | Monaco Editor 需用 `editor.getValue() !== newVal`  guards 避免无效 setValue |
| JAVA-006 | `any(CreditsTransaction.class)` 在 MyBatis Plus 中可能匹配多条记录 |
| P0-001 | PowerShell `Set-Content -NoNewline` 删除所有换行符 + 破坏 UTF-8 → 22 个文件损坏 |
| P0-DEV-001 | postgres `/docker-entrypoint-initdb.d/` 只在数据目录为空时执行 |

---

## Mistakes to Avoid

1. **不要用 PowerShell `Set-Content -NoNewline` 批量修改文件** — 使用 `StrReplaceFile` 或 Python UTF-8
2. **不要假设 dev/prod 配置一致** — 每次变更需双向同步验证
3. **不要忽视 `nuxt typecheck` 历史错误** — 开发前先 `npm run type-check`
4. **不要用 `fs.exists` 的 async/await 封装** — 使用 `fs.promises.access`
5. **不要在 monaco-editor 中无条件 `setValue`** — 加 diff guards 避免触发 watcher 风暴
6. **不要给敏感配置留 fallback 默认值** — 缺失 env 时服务应崩溃而非用默认密码启动

---

## Skill Additions Recommended

| Skill | 来源 | 优先级 |
|-------|------|--------|
| `java/patterns/schema-migration.md` | FEAT-001a/b, JAVA-004/006 | P1 |
| `platform/patterns/dev-prod-config-separation.md` | P0-DEV-001, MON-1/2 | P1 |
| `frontend/patterns/monaco-editor-integration.md` | FEAT-006b | P2 |
| `node/patterns/multer-error-handling.md` | FEAT-002a | P2 |

---

## Archive Note

原始 22 个 reflection 文件已归档至 `.kimi/memory/archive/reflections/2026-04/`。
如需追溯具体 Ticket 细节，搜索对应 `TICKET-XXX.md` 文件。
