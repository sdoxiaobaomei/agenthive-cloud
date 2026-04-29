# Reflection: TICKET-FEAT-001b — Project 成员管理 API

## 执行摘要
在 FEAT-001a 数据模型基础上，实现项目成员管理的完整 REST API，包含权限控制与业务规则校验。

## 关键决策

### 决策 1：Controller 层权限校验而非 Express Middleware
- **选项 A**：新建 `requireProjectRole` Express middleware，挂载到路由
- **选项 B**：在 Controller 每个端点内调用异步辅助函数 `requireProjectAdmin`
- **选择 B 原因**：
  - middleware 无法优雅地访问 route params（如 `:id`）进行异步数据库查询
  - 辅助函数可返回 boolean，Controller 直接 `if (!ok) return` 即可，代码更直观
  - 避免增加新的中间件文件，降低认知负担

### 决策 2：owner 保护规则放在应用层而非数据库触发器
- **原因**：触发器错误难以返回定制化中文提示；应用层检查更灵活，便于后续策略配置
- **实现**：`countOwners(projectId)` 查询 + Controller 前置检查

### 决策 3：成员查询 JOIN users 并显式选择公开字段
- **SQL**：`SELECT pm.*, u.username, u.avatar FROM project_members pm JOIN users u ...`
- **理由**：直接 `SELECT *` 会连带返回 users 表的 password_hash 等敏感字段，违反 Ticket 脱敏要求

## 文件变更统计
| 文件 | 变更类型 |
|------|----------|
| `apps/api/src/project/routes.ts` | 重写：新增 4 条成员管理路由 |
| `apps/api/src/project/controller.ts` | 重写：新增 4 个端点 + 2 个权限辅助函数 + 2 个 Zod schema |
| `apps/api/src/project/service.ts` | 编辑：新增 getMemberRole + countOwners 方法 |

## 验证结果
- `npm run typecheck`：✅ 通过
- `npm test`（project.service）：✅ 12/12 通过
- `npm test`（全量）：✅ 56 通过 / 10 失败（全部 pre-existing）

## API 端点清单
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/projects/:id/members | 项目成员 | 查询成员列表 |
| POST | /api/projects/:id/members | owner/admin | 邀请/更新成员角色 |
| PATCH | /api/projects/:id/members/:userId | owner/admin | 更新角色（viewer 不可升 admin） |
| DELETE | /api/projects/:id/members/:userId | owner/admin | 移除成员（至少保留 1 owner） |

## 学到的模式

### Pattern: 权限辅助函数的返回值模式
```typescript
async function requireProjectAdmin(req, res, projectId): Promise<boolean> {
  const role = await service.getMemberRole(projectId, req.userId)
  if (!role || (role !== 'owner' && role !== 'admin')) {
    res.status(403).json({ ... })  // 直接写入响应
    return false
  }
  return true
}
// 使用：if (!(await requireProjectAdmin(...))) return
```
适用于需要在 Controller 内进行异步权限查询的场景，避免了 middleware 与 route params 的耦合问题。

### Pattern: 应用层业务规则守卫
对于"至少保留 N 个 X"这类规则，应用层守卫优于数据库触发器：
1. 更友好的错误信息（可返回 JSON 而非数据库错误码）
2. 更灵活的策略调整（可通过配置开关）
3. 更易于单元测试（mock service 方法即可）

## 后续建议
1. **FEAT-001c 就绪**：FEAT-001a（数据模型）和 FEAT-001b（成员管理 API）均已完成，FEAT-001c（Project 创建与 Workspace 初始化）的依赖已满足，可立即执行。
2. **权限抽象**：如后续出现更多需要项目角色校验的模块（如代码审查、部署权限），
   建议将 `requireProjectAdmin` / `requireProjectMember` 提取为通用工具函数或装饰器。
3. **activity_log 表**：当前成员变动仅记录到 logger，后续 Ticket 可考虑将 activity_log 表落地，
   支持项目 Dashboard 的活动时间线展示。
