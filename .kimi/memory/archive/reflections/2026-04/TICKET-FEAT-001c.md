# TICKET-FEAT-001c Reflection

## Summary
Project 创建与 Workspace 自动初始化功能已实现，支持 blank 模板复制和 git-import 异步 clone 两种模式。

## Changes

### 1. `apps/api/src/project/service.ts`
- 新增 `initBlankWorkspace(projectId, userId, techStack)`：按 tech_stack 从 `apps/api/templates/{vue,react,node,java}/` 复制模板到 `data/workspaces/{userId}/{projectId}`
- 新增 `startGitClone(projectId, userId, gitUrl, gitBranch)`：启动异步 git clone，返回 jobId + status='cloning'
- 新增 `getCloneJob(jobId)`：查询 clone 任务状态
- `runGitClone` 内部实现：spawn git clone，60s 超时，stderr 捕获，close/error 事件处理
- `rollbackClone`：失败时自动删除 DB 记录（projects + project_members）+ 清理目录
- Clone 状态暂用内存 Map 追踪（单节点足够，多节点场景后续可迁移到 Redis）

### 2. `apps/api/src/project/controller.ts`
- `createProject` 分支处理：
  - `type=blank` → `initBlankWorkspace` → 返回完整 project
  - `type=git-import` → `startGitClone` → 返回 `{projectId, jobId, status: 'cloning'}`
  - Zod 校验：blank 必须提供 tech_stack；git-import 必须提供 git_url
- 新增 `getCloneStatus`：GET `/api/projects/:id/clone-status?jobId=xxx`

### 3. `apps/api/src/project/routes.ts`
- 新增 `GET /:id/clone-status`

## Verification
- `npm run typecheck` ✅
- `npx vitest run tests/unit/project.service.test.ts` ✅ (12 passed)
- `npm run lint` ✅ (echo only)
- 生产路径零 `console.log` ✅

## Pre-existing Failures (Not Introduced)
- `taskExecution.service.test.ts` ×2 (历史契约不匹配)
- `auth.middleware.test.ts` ×8 (dev mode 注入覆盖测试环境)

## Security Considerations
- Git clone 使用 `process.env` 透传环境变量，支持 `GIT_SSH_KEY` / `HTTPS_TOKEN`（无 hardcode）
- Workspace 路径基于 `resolve(WORKSPACE_BASE, userId, projectId)`，无路径遍历风险
- Rollback 同时清理 DB + 文件系统，避免脏数据

## Future Work
- Clone 状态持久化：当前内存 Map 在进程重启后丢失，可考虑 Redis Hash
- Git clone 进度流：当前仅返回 status，可扩展为 SSE/WebSocket 实时推送
