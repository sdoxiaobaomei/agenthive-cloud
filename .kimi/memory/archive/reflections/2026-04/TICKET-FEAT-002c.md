# TICKET-FEAT-002c Reflection

## Summary
Workspace Git 状态查询功能已实现。新增 GET 端点，通过执行 git 命令获取当前分支、commit、修改状态、ahead/behind 等信息。

## Changes

### 1. `apps/api/src/controllers/code.ts`
- 新增 `getWorkspaceGitStatus`：
  - 检查 `.git` 目录存在性，非 git 仓库返回 400
  - `git branch --show-current` → 当前分支
  - `git rev-parse --short HEAD` → commit hash
  - `git status --porcelain` → 解析 modified/untracked/staged 文件列表
  - `git rev-list --count` → ahead/behind 上游分支数量（无上游时为 null）
- 新增 `execAsync` 包装函数：基于 `child_process.exec`，处理 `string | Buffer` 类型的 stdout/stderr，带 10s 超时
- 新增 `parseGitStatusPorcelain`：解析 `git status --porcelain` 输出，分类 modified/untracked/staged
- 新增 `GitStatusResult` 类型接口

### 2. `apps/api/src/routes/code.ts`
- 注册 `GET /workspace/git-status` → `getWorkspaceGitStatus`

## Verification
- `npm run typecheck` ✅
- `npm run lint` ✅
- 生产路径零 `console.log` ✅

## Pre-existing Issues
- `code.controller.test.ts` 因 bcrypt 加载失败无法运行（测试环境问题）
- `taskExecution.service.test.ts` ×2（历史契约不匹配）
- `auth.middleware.test.ts` ×8（dev mode 注入覆盖测试环境）

## Security Considerations
- 通过 `access('.git')` 确认 workspace 是 git 仓库后才执行 git 命令
- 所有 git 命令设置 10s 超时，防止 hangs
- 使用 `getUserWorkspace()` 解析路径，与现有路径安全检查一致

## Future Work
- 可扩展 `git log --oneline -n 10` 返回最近提交历史
- 可集成 `git diff --stat` 返回修改文件的行数统计
