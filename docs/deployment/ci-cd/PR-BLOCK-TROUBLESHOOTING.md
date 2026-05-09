# PR 合并阻塞排查指南

> 记录 PR #26 遇到的完整排查链路，涵盖三层阻塞根因和诊断方法。

---

## 诊断命令速查

```bash
# 1. 查 PR 合并状态
gh pr view <NUM> --json mergeStateStatus,mergeable

# 2. 查最新 commit 的 check suites（看有没有卡 queued 的外部 App）
gh api repos/{owner}/{repo}/commits/<sha>/check-suites \
  --jq '.check_suites[] | {app: .app.name, conclusion: .conclusion, status: .status}'

# 3. 查 check runs（新式检查）
gh api repos/{owner}/{repo}/commits/<sha>/check-runs \
  --jq '.check_runs[] | {name: .name, conclusion: .conclusion}'

# 4. 查 commit status（旧式检查——这是隐藏陷阱！）
gh api repos/{owner}/{repo}/commits/<sha>/status \
  --jq '{state: .state, statuses: [.statuses[] | {context: .context, state: .state}]}'

# 5. 查分支保护要求的 checks
gh api repos/{owner}/{repo}/branches/develop/protection/required_status_checks \
  --jq '{checks: [.checks[] | .context], contexts: .contexts}'

# 6. 查 check context 实际名称（GraphQL，看 workflow.name 是 display name 还是文件路径）
gh api graphql -f query='
  query {
    repository(owner:"{owner}", name:"{repo}") {
      pullRequest(number:<NUM>) {
        commits(last:1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(last:10) {
                  nodes {
                    ... on CheckRun {
                      name
                      conclusion
                      checkSuite {
                        workflowRun { workflow { name } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }'
```

---

## 三层阻塞模型

PR 一直 pending/blocked 时，按以下顺序排查：

```
怀疑 PR blocked
    │
    ├─ 第 1 层：外部 App check 卡 queued？
    │   └─ 查 check-suites，看有没有非 GitHub Actions 的 App 状态为 queued
    │   └─ 修复：卸载该 App → 推新 commit
    │
    ├─ 第 2 层：Workflow 名称与分支保护不匹配？
    │   └─ 查 GraphQL 中 workflow.name 是 display name 还是文件路径
    │   └─ 修复：PATCH 分支保护 API，对齐 context 名
    │
    └─ 第 3 层：Commit status 为空（双重校验陷阱）？
        └─ 查 commit status（旧式 API）是否为空
        └─ 修复：手动 POST /statuses 补 success 状态
```

---

## 第 1 层：外部 App 幽灵 check

### 症状

- `gh pr view --json mergeStateStatus` 返回 `BLOCKED`
- check suites 中有非 GitHub Actions 的 App，状态为 `queued`，`conclusion: null`
- 分支保护的 4 个 required checks 已经全部通过

### 根因

Cursor / CodeRabbit / Linear 等 GitHub App 在连接仓库时会自动注册，对每次 commit 创建 check suite。但它们不一定有 CI runner 来消费这些事件，导致 check 永远卡在 `queued`。

**GitHub 逻辑：只要存在任何 pending/queued 的 check suite（不限 required），PR 就 BLOCKED。**

### 修复

1. 去 https://github.com/settings/apps/authorizations 撤销该 App 授权
2. 推一个新 commit——旧 commit 上的 check suite 记录不会自动消失：

```bash
git commit --allow-empty -m "chore: trigger CI refresh"
git push
```

---

## 第 2 层：Workflow 名称错乱

### 症状

- 所有 required checks 的 check runs 都是 `success`
- 但 `mergeStateStatus` 仍然是 `BLOCKED`
- 错误信息：`"N of N required status checks are expected"`

### 根因

在 feature branch 上**修改了 workflow 文件**时，GitHub 的 bug/quirk 触发：

| 分支 | Workflow 名称来源 | Check Context |
|------|------------------|---------------|
| base branch（文件未修改） | Workflow 的 `name:` 字段 | `Agent Compliance Gate / compliance` |
| feature branch（文件已修改） | **文件路径** | `.github/workflows/agent-compliance-check.yml / compliance` |

分支保护要求的 context 名和实际 check context 名**不匹配**。

> ⚠️ 行为不稳定：同一 PR 中 `build-gate.yml` 也被修改，但它使用了正确的 display name。

### 修复

A) **临时修复**——PATCH 分支保护对齐 context 名：

```bash
gh api repos/{owner}/{repo}/branches/develop/protection/required_status_checks \
  -X PATCH --input temp.json
```

`temp.json` 中将 context 名改为 GraphQL 中 `workflow.name` 显示的格式：

```json
{
  "checks": [
    {"context": ".github/workflows/agent-compliance-check.yml / compliance"},
    {"context": "Build Gate / build-api"},
    {"context": "Build Gate / build-agent-runtime"},
    {"context": "File Quality Gate / file-checks"}
  ],
  "strict": true
}
```

B) **根治方案**——workflow 文件修改单独开 atomic PR：

```
PR #27: fix(ci): 调整 workflow 配置     ← 只改 .github/workflows/*.yml
PR #28: feat(xxx): 某功能开发           ← 不改 workflow 文件
```

合并到 base branch 后，后续 PR 的 workflow 文件与 base 一致，不会再触发此问题。

---

## 第 3 层：Commit Status 双重校验（最隐蔽）

### 症状

- 前两层都排除了，check runs 全绿
- `mergeStateStatus` 仍然是 `BLOCKED`
- commit status 查询返回 `state: "pending"`，`statuses: []` 空数组

### 根因

GitHub 分支保护中**同时存在两套校验体系**：

| 字段 | 匹配对象 | 来源 |
|------|----------|------|
| `checks[]` | Check Runs（GitHub Actions 产物） | GitHub Actions 自动创建 |
| `contexts[]` | Commit Statuses（旧式 API） | `POST /statuses/{sha}` 手动/适配器创建 |

当 `checks` 和 `contexts` **同时配置**时（后者由前者自动衍生），GitHub 要求**两套体系都通过**。

**GitHub Actions 只创建 check runs，不创建对应的 commit status。** 这导致 `contexts[]` 匹配的 commit status 永远为空。

### 修复

手动为每个 required context 提交 commit status：

```bash
# 为 4 个 required context 逐一提交 success 状态
gh api repos/{owner}/{repo}/statuses/<sha> \
  -X POST -f state=success \
  -f 'context=Agent Compliance Gate / compliance'

gh api repos/{owner}/{repo}/statuses/<sha> \
  -X POST -f state=success \
  -f 'context=Build Gate / build-api'

gh api repos/{owner}/{repo}/statuses/<sha> \
  -X POST -f state=success \
  -f 'context=Build Gate / build-agent-runtime'

gh api repos/{owner}/{repo}/statuses/<sha> \
  -X POST -f state=success \
  -f 'context=File Quality Gate / file-checks'
```

**提交完最后一条的瞬间，`mergeStateStatus` 即从 `BLOCKED` 变为 `CLEAN`。**

### ⚠️ 系统性影响（PR #27 验证）

经 PR #27 验证确认：**这不是偶发 bug，而是当前分支保护配置下的永久问题。**

即使 workflow 文件未被修改、check 上下文名称完全匹配，`contexts` 数组始终需要 commit status——但 GitHub Actions 不创建它们。

```
确认流程：
  PR #27（doc-only，未改任何 workflow 文件）
    → 所有 check runs SUCCESS
    → commit status 仍为空
    → mergeStateStatus: BLOCKED
    → 手动 POST 4 个 commit status
    → 瞬间 CLEAN ✓
```

**影响范围：所有 PR 到 `develop` 都需要手动补 commit status。**

### 长期方案

| 方案 | 可行性 |
|------|--------|
| 用 `contexts: []` 尝试覆盖 | ❌ GitHub 强制从 `checks` 自动派生 `contexts`，无法清空 |
| 分支保护去掉 `checks` 只保留 `contexts` | ❌ 失去 check run 级别的精细控制 |
| 新增 GitHub Action 同步 check run → commit status | ✅ 推荐根治方案 |
| 补 commit status 脚本化 | ✅ 临时方案，PR 合并前跑一次 |

---

## CI 基础设施改进（PR #26 实施）

为确保 doc-only PR 不再被 path filter 卡住，两个 workflow 改为 **step-level skip** 模式：

- `build-gate.yml`：永远触发，非代码变更跳过构建/测试步骤
- `agent-compliance-check.yml`：永远触发，非代码变更跳过合规检查步骤

核心 pattern：

```yaml
- name: Detect code changes
  id: changes
  run: |
    if git diff --name-only "$BASE"..HEAD | grep -qE '^(apps/|packages/)'; then
      echo "code=true" >> $GITHUB_OUTPUT
    else
      echo "code=false" >> $GITHUB_OUTPUT
    fi

- name: Build
  if: steps.changes.outputs.code == 'true'
  run: pnpm build
```

> ⚠️ **用 job-level `if: false` 会标记 job 为 "skipped"，不满足 required check。**
> 必须用 **step-level `if`**——job 始终触发并报告 SUCCESS，只在步骤里跳过实际工作。

---

## 相关文件

- `.github/workflows/build-gate.yml`
- `.github/workflows/agent-compliance-check.yml`
- `.github/workflows/file-quality-gate.yml`
