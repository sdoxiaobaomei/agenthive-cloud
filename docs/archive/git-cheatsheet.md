# Git 分支管理速查表

> 快速参考指南 - AI DevOps Platform

---

## 🚀 快速开始

### 初始化（首次设置）

```bash
# 1. 克隆仓库
git clone <repo-url>
cd ai-digital-twin

# 2. 配置提交模板
git config --local commit.template .gitmessage

# 3. 运行分支初始化脚本（如需要）
bash scripts/init-git-branches.sh
# Windows PowerShell:
# .\scripts\init-git-branches.ps1
```

---

## 📋 常用命令

### 日常工作流程

```bash
# 1. 更新主分支
git checkout main
git pull origin main

# 2. 同步到你的工作分支
git checkout agent/<your-role>
git merge main

# 3. 创建功能分支
git checkout -b feature/<agent>-<description>

# 4. 开发并提交
git add .
git commit -m "feat(scope): description"
git push origin feature/<agent>-<description>

# 5. 在GitHub/GitLab创建MR/PR到main

# 6. 合并后清理
git checkout main
git pull origin main
git branch -d feature/<agent>-<description>
git push origin --delete feature/<agent>-<description>
```

### 分支操作

```bash
# 查看分支
git branch              # 本地分支
git branch -r           # 远程分支
git branch -a           # 所有分支

# 切换分支
git checkout main
git checkout agent/frontend

# 创建并切换
git checkout -b feature/xxx

# 删除分支
git branch -d feature/xxx      # 已合并
git branch -D feature/xxx      # 强制删除

# 重命名分支
git branch -m old-name new-name
```

### 同步与合并

```bash
# 获取最新代码
git fetch origin
git pull origin main

# 合并分支
git checkout main
git merge feature/xxx

# 使用rebase保持线性历史
git checkout feature/xxx
git rebase main
```

---

## 📝 提交规范

### 提交类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(frontend): add dark mode` |
| `fix` | Bug修复 | `fix(api): resolve cors error` |
| `docs` | 文档 | `docs(readme): update setup guide` |
| `style` | 代码格式 | `style(frontend): fix eslint` |
| `refactor` | 重构 | `refactor(user): simplify auth` |
| `perf` | 性能优化 | `perf(db): add index` |
| `test` | 测试 | `test(chat): add unit tests` |
| `chore` | 杂项 | `chore(deps): update fastapi` |
| `ci` | CI/CD | `ci(docker): optimize build` |
| `revert` | 回滚 | `revert: remove feature` |

### Scope 范围

| Scope | 说明 |
|-------|------|
| `frontend` | Vue3前端 |
| `chat` | Chat Service (Python) |
| `user` | User Service (Go) |
| `skill` | Skill Service (Java) |
| `api` | API Gateway |
| `infra` | 基础设施/K8s |
| `docs` | 文档 |
| `*` | 多范围修改 |

### 提交示例

```bash
# 简单提交
git commit -m "feat(frontend): add login page"

# 带body的提交
git commit -m "feat(chat): implement streaming

- Add SSE endpoint
- Handle connection retry
- Add error handling

Refs: #123"

# Breaking Change
git commit -m "feat(api)!: change auth format

BREAKING CHANGE: header now requires 'Bearer' prefix"
```

---

## 🆘 常见问题解决

### 冲突解决

```bash
# 1. 获取最新代码
git fetch origin

# 2. 尝试合并或rebase
git rebase origin/main

# 3. 解决冲突文件后
git add <conflicted-file>
git rebase --continue

# 放弃rebase
git rebase --abort
```

### 撤销操作

```bash
# 撤销工作区修改
git checkout -- <file>

# 撤销暂存区
git reset HEAD <file>

# 修改最后一次提交
git commit --amend

# 回退到指定版本（保留修改）
git reset --soft HEAD~1

# 回退到指定版本（丢弃修改）
git reset --hard HEAD~1

# 查看操作历史（用于恢复）
git reflog
```

### 紧急修复流程

```bash
# 1. 从production创建hotfix分支
git checkout production
git pull origin production
git checkout -b hotfix/99-fix-login

# 2. 修复并提交
git commit -m "fix(auth): correct login validation"

# 3. 推送到远程
git push origin hotfix/99-fix-login

# 4. 创建PR到production

# 5. 合并后同步回main
git checkout main
git merge hotfix/99-fix-login
git push origin main
```

---

## 🔗 分支关系图

```
                    feature/agent-xxx
                           │
                           │ PR/MR
                           ▼
┌────────┐    ┌────────┐  ┌────────┐   ┌────────────┐   ┌────────────┐
│ agent/ │───►│  main  │◄─┤ staging│◄──┤  pre-prod  │◄──┤ production │
│  xxx   │    │        │  │        │   │  (可选)     │   │            │
└────────┘    └────────┘  └────────┘   └────────────┘   └────────────┘
                                                  ▲            │
                                                  │            │
                                            hotfix/xxx ◄───────┘
```

---

## 📊 7-Agent 分支对照

| Agent | 工作分支 | 主要职责 |
|-------|----------|----------|
| PM | `agent/pm` | 需求、PRD、产品文档 |
| Arch | `agent/arch` | 架构设计、技术选型 |
| Frontend | `agent/frontend` | Vue3前端开发 |
| Backend-Py | `agent/backend-py` | Chat Service |
| Backend-Go | `agent/backend-go` | User Service |
| Backend-Java | `agent/backend-java` | Skill Service |
| Ops | `agent/ops` | DevOps、K8s、CI/CD |

---

## 💡 最佳实践

1. **频繁同步** - 每天至少同步一次 main 到工作分支
2. **小步提交** - 功能拆小，频繁提交
3. **写清楚提交信息** - 方便后续追溯
4. **先pull再push** - 避免冲突
5. **删除已合并分支** - 保持仓库整洁
6. **用MR/PR合并** - 强制代码审查

---

## 🛠️ 推荐别名配置

```bash
# 添加到 ~/.gitconfig 或项目 .git/config

[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    lg = log --oneline --graph --decorate
    lga = log --oneline --graph --decorate --all
    last = log -1 HEAD
    unstage = reset HEAD --
    discard = checkout --
    amend = commit --amend
    ff = merge --ff-only
    nff = merge --no-ff
```

使用：
```bash
git st      # git status
git co main # git checkout main
git lg      # 图形化日志
git amend   # 修改上次提交
```

---

**更多详情参见:** [完整分支策略文档](./git-branching-strategy.md)
