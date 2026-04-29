# Reflection: TICKET-FEAT-001a — Project 数据模型扩展与数据库迁移

## 执行摘要
扩展 projects 表字段，新增 project_members 表，更新 TypeScript 类型定义与 Service/Controller 层，完成数据库迁移脚本。

## 关键决策

### 决策 1：纯 SQL 迁移而非 node-pg-migrate
- **原因**：项目无 node-pg-migrate 依赖，引入新依赖增加复杂度；纯 SQL 脚本更直观，DBA 可直接审阅。
- **结果**：提供 up/down 一对脚本，使用 `IF EXISTS/IF NOT EXISTS` 保证幂等性。

### 决策 2：新旧字段默认值策略
- **type**: DEFAULT 'blank' — 与 Ticket 要求的旧项目兼容策略一致
- **git_branch**: DEFAULT 'main' — 行业惯例
- **is_template**: DEFAULT FALSE — 绝大多数项目非模板
- **其余字段**: 无 DEFAULT，允许 NULL — 表示未设置

### 决策 3：UPDATE 使用 COALESCE 模式
- **优点**：PATCH 语义下未提供的字段保持原值
- **代价**：参数数量膨胀（从 5 到 12），单元测试需要同步更新硬编码参数数组
- **替代方案**：动态构建 UPDATE 语句（仅 SET 提供的字段），但会增加 SQL 注入风险和代码复杂度

## 文件变更统计
| 文件 | 变更类型 |
|------|----------|
| `apps/api/src/db/schema.sql` | 编辑：新增 7 字段 + project_members 表 + 2 索引 |
| `apps/api/src/project/types.ts` | 重写：Project 扩展 + ProjectMember 新增 + Input 扩展 |
| `apps/api/src/project/service.ts` | 重写：create/update SQL 扩展 + 成员管理 4 方法 |
| `apps/api/src/project/controller.ts` | 编辑：Zod schema 扩展 |
| `apps/api/src/db/index.ts` | 编辑：projectDb SQL 与参数同步 |
| `apps/api/tests/unit/project.service.test.ts` | 编辑：4 处参数数组同步扩展 |
| `apps/api/scripts/migrate-001a-up.sql` | 新增：升级迁移 |
| `apps/api/scripts/migrate-001a-down.sql` | 新增：回滚迁移 |

## 验证结果
- `npm run typecheck`：✅ 通过
- `npm test`（project.service）：✅ 12/12 通过
- `npm test`（全量）：✅ 56 通过 / 10 失败（全部 pre-existing）

## 学到的模式

### Pattern: Schema 变更的三层同步
数据库 schema 变更必须同步三层，否则会产生类型或运行时错误：
1. **SQL 层**：schema.sql + 迁移脚本
2. **类型层**：TypeScript interface
3. **查询层**：Service/Repository SQL 参数

### Pattern: 测试参数数组的脆弱性
当 Service 层使用 `pool.query(sql, params)` 时，单元测试 mock 往往硬编码 `expect(mockQuery).toHaveBeenCalledWith(sql, [param1, param2])`。
这种测试在 schema 扩展时极易断裂。后续可考虑将参数构建逻辑提取为独立函数，降低测试耦合。

## 后续建议
1. **FEAT-001b 依赖**：project_members 表已就绪，projectService 已提供 addMember/removeMember/updateMemberRole/findMembers 方法，
   FEAT-001b 可直接复用。
2. **迁移执行**：生产环境执行 `migrate-001a-up.sql` 前，务必在维护窗口内备份数据库。
3. **索引审查**：project_members 上的 (project_id, user_id) 唯一索引可满足大部分查询，
   如后续出现按 role 过滤的高频查询，可补充 `idx_project_members_role`。
