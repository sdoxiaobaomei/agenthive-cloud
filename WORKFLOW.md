# AgentHive 完整工作流指南

## 用户需求进入后的完整流程

### 流程概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          用户需求生命周期                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  阶段0          阶段1          阶段2          阶段3          阶段4          │
│  接收需求  →   规划拆解   →   并行开发   →   集成验收   →   归档清理         │
│                                                                             │
│  /plan         Orchestrator    Workers       QA/Staging     Archive        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 详细流程

### 🔹 阶段 0: 接收需求（用户触发）

**触发方式**: 用户在对话中输入需求

```
用户: /plan 给 Dashboard 增加导出 Excel 功能，支持按日期筛选
```

**系统检查**:
```bash
# 自动执行
node scripts/workspace-lifecycle.js list

# 检查项:
├─ 当前活跃工作区数量: 5/20 ✅ (< 20，可以继续)
├─ 磁盘空间检查: ✅
└─ 是否有同名需求: ✅
```

**如果超过 20 个活跃工作区**:
```
⚠️ 警告: 当前有 23 个活跃工作区，建议先完成或归档以下任务:
   - T-001: Dashboard 重构 (已活跃 7 天)
   - T-005: API 优化 (已活跃 5 天)

用户选项:
1. 继续创建 (强制)
2. 先处理积压任务
3. 自动归档旧任务
```

---

### 🔹 阶段 1: 规划拆解（Orchestrator - 阿黄）

**执行者**: Orchestrator (Tech Lead)

**步骤**:

1. **需求分析**
   ```
   阿黄分析:
   - 需求复杂度: 中等
   - 涉及模块: frontend + backend
   - 预估工作量: 3 Tickets
   ```

2. **生成 Plan**
   ```json
   {
     "plan_summary": "Dashboard Excel 导出功能",
     "tickets": [
       {
         "id": "T-024",
         "role": "frontend_dev",
         "task": "添加导出按钮和前端导出逻辑",
         "context": {
           "relevant_files": [
             "apps/landing/pages/app/dashboard.vue"
           ],
           "constraints": ["使用 Element Plus 组件", "支持日期筛选"],
           "depends_on": []
         }
       },
       {
         "id": "T-025",
         "role": "backend_dev",
         "task": "实现 /api/export Excel 导出接口",
         "context": {
           "relevant_files": [
             "apps/api/src/routes/index.ts"
           ],
           "constraints": ["支持大数据量导出", "xlsx 格式"],
           "depends_on": []
         }
       },
       {
         "id": "T-026",
         "role": "qa_engineer",
         "task": "验证导出功能完整性和性能",
         "context": {
           "relevant_files": [],
           "constraints": [],
           "depends_on": ["T-024", "T-025"]
         }
       }
     ],
     "notes": "建议先并行开发前后端，最后集成测试"
   }
   ```

3. **初始化工作区**
   ```bash
   # 自动执行
   node scripts/workspace-lifecycle.js init T-024 "Dashboard Excel导出-前端"
   node scripts/workspace-lifecycle.js init T-025 "Dashboard Excel导出-后端"
   node scripts/workspace-lifecycle.js init T-026 "Dashboard Excel导出-QA"
   
   # 设置初始状态
   node scripts/workspace-lifecycle.js status T-024 active
   node scripts/workspace-lifecycle.js status T-025 active
   node scripts/workspace-lifecycle.js status T-026 paused  # QA 等待中
   ```

4. **输出给用户**
   ```
   📋 Plan 生成完成: Dashboard Excel 导出功能
   
   ├─ T-024 🟢 (小花/前端) - 添加导出按钮和前端逻辑
   │     文件: dashboard.vue
   │     状态: 待开始 → 输入 /ticket T-024 开始
   │
   ├─ T-025 🟢 (阿铁/后端) - 实现 /api/export 接口
   │     文件: routes/index.ts
   │     状态: 待开始 → 输入 /ticket T-025 开始
   │
   └─ T-026 ⏸️ (阿镜/QA) - 验证导出功能
         依赖: T-024, T-025
         状态: 等待开发完成
   
   💡 提示: T-024 和 T-025 可以并行开始
   ```

---

### 🔹 阶段 2: 并行开发（Workers）

#### 2.1 前端开发（T-024 - 小花）

**用户触发**:
```
用户: /ticket T-024
```

**系统自动执行**:
```bash
# 1. 加载工作区上下文
cd AGENTS/workspace/T-024/repo

# 2. 读取 TICKET.yaml
TICKET:
  id: T-024
  role: frontend_dev
  task: "添加导出按钮和前端导出逻辑"
  relevant_files:
    - apps/landing/pages/app/dashboard.vue

# 3. 创建 Git 分支
git checkout -b ticket/T-024-dashboard-export

# 4. 更新状态
node scripts/workspace-lifecycle.js status T-024 active
```

**小花工作过程**:
```
[前端开发模式 - 小花]

1. 读取相关文件:
   - dashboard.vue (了解现有结构)
   - 确认导出按钮放置位置

2. 开发:
   - 添加导出按钮组件
   - 实现日期选择器
   - 调用 /api/export 接口
   - 处理下载逻辑

3. 本地测试:
   npm run dev
   # 测试导出功能

4. 提交到工作区:
   git add .
   git commit -m "feat(T-024): 添加 Dashboard Excel 导出功能"
   
5. 标记完成
```

**用户输入**:
```
用户: /done T-024
或
用户: 完成了 T-024
```

**系统执行**:
```bash
node scripts/workspace-lifecycle.js status T-024 completed

# 检查依赖:
# T-026 依赖 T-024 和 T-025
# T-025 还未完成，T-026 保持 paused
```

---

#### 2.2 后端开发（T-025 - 阿铁）

**并行执行**（与 T-024 同时）:
```
用户: /ticket T-025
```

**阿铁工作过程**:
```
[后端开发模式 - 阿铁]

1. 读取相关文件:
   - routes/index.ts
   - 了解现有 API 结构

2. 开发:
   - 添加 POST /api/export 路由
   - 实现 Excel 生成逻辑
   - 添加日期筛选参数
   - 处理大数据量导出

3. 本地测试:
   npm run dev
   curl -X POST http://localhost:3000/api/export

4. 提交到工作区
5. 标记完成
```

**系统执行**:
```bash
node scripts/workspace-lifecycle.js status T-025 completed

# 检查依赖:
# T-024: completed ✅
# T-025: completed ✅
# T-026: 依赖全部满足，可以激活

node scripts/workspace-lifecycle.js status T-026 active

通知用户: "T-024 和 T-025 都已完成，T-026 (QA) 可以开始了"
```

---

### 🔹 阶段 3: 集成验收（QA + Staging）

#### 3.1 合并到 Staging

**系统自动执行**:
```bash
# 创建 staging 环境
mkdir -p AGENTS/workspace/staging/repo

# 复制主仓库代码
cp -r apps/* AGENTS/workspace/staging/repo/

# 合并 T-024 的修改
cd AGENTS/workspace/staging/repo
git checkout -b staging/T-024-T-025

# 应用 T-024 的 patch
git apply ../T-024/repo/changes.patch

# 应用 T-025 的 patch
git apply ../T-025/repo/changes.patch

# 解决冲突（如果有）
# ...
```

#### 3.2 QA 审查（T-026 - 阿镜）

**用户触发**:
```
用户: /ticket T-026
```

**阿镜工作过程**:
```
[QA 模式 - 阿镜]

1. 读取上下文:
   - T-024 的修改: dashboard.vue
   - T-025 的修改: routes/index.ts
   - Staging 环境已准备

2. 代码审查:
   - 检查代码规范
   - 检查错误处理
   - 检查性能问题

3. 功能测试:
   cd AGENTS/workspace/staging/repo
   npm run dev
   # 测试导出功能
   # 测试日期筛选
   # 测试大数据量

4. 运行单元测试:
   npm run test:unit

5. 输出 QA 报告:
```

**QA 结果 A: 通过** ✅
```json
{
  "ticketId": "T-026",
  "status": "approved",
  "summary": "代码质量和功能都符合要求",
  "issues": [],
  "testResults": {
    "unitTests": "passed",
    "e2eTests": "passed"
  }
}
```

**QA 结果 B: 拒绝** ❌
```json
{
  "ticketId": "T-026",
  "status": "rejected",
  "summary": "发现 2 个问题需要修复",
  "issues": [
    {
      "ticketId": "T-024",
      "file": "dashboard.vue",
      "line": 45,
      "problem": "导出按钮没有 loading 状态",
      "suggestion": "添加 loading 状态防止重复点击"
    },
    {
      "ticketId": "T-025",
      "file": "routes/index.ts",
      "line": 128,
      "problem": "大数据量导出会阻塞",
      "suggestion": "使用流式导出"
    }
  ]
}
```

**如果拒绝**:
```
系统自动创建 Fix Tickets:

T-024-FIX: 添加 loading 状态
  父任务: T-024
  分配给: 小花
  
T-025-FIX: 流式导出优化
  父任务: T-025
  分配给: 阿铁

用户: /ticket T-024-FIX
# ... 修复 ...

修复完成后，重新 QA:
用户: /ticket T-026
```

---

#### 3.3 合并到主仓库

**QA 通过后，系统自动执行**:
```bash
# 1. 合并到主仓库
cd apps
git checkout main
git pull

# 2. 创建合并分支
git checkout -b feature/T-024-T-025-dashboard-export

# 3. 应用修改
cp -r AGENTS/workspace/staging/repo/* .

# 4. 提交
git add .
git commit -m "feat: Dashboard Excel 导出功能 (T-024, T-025, T-026)

- 添加导出按钮和前端逻辑 (T-024)
- 实现 /api/export 接口 (T-025)
- QA 验证通过 (T-026)

相关文件:
- apps/landing/pages/app/dashboard.vue
- apps/api/src/routes/index.ts"

# 5. 推送
git push origin feature/T-024-T-025-dashboard-export

# 6. 输出给用户
```

**输出给用户**:
```
🎉 功能已完成并合并！

📋 合并信息:
   分支: feature/T-024-T-025-dashboard-export
   Commit: a1b2c3d4
   
📁 修改文件:
   - apps/landing/pages/app/dashboard.vue (+120/-15)
   - apps/api/src/routes/index.ts (+85/-5)

🔗 下一步:
   1. 创建 Pull Request 到 main 分支
   2. 部署到测试环境
   3. 7 天后工作区将自动归档

💾 工作区将在 7 天后归档，如需保留请标记:
   node scripts/workspace-lifecycle.js status T-024 keep
```

**更新工作区状态**:
```bash
node scripts/workspace-lifecycle.js status T-024 merged a1b2c3d4
node scripts/workspace-lifecycle.js status T-025 merged a1b2c3d4
node scripts/workspace-lifecycle.js status T-026 merged a1b2c3d4
```

---

### 🔹 阶段 4: 归档清理（自动执行）

#### 4.1 自动清理任务（每日凌晨 3 点）

```bash
# crontab 定时任务
0 3 * * * cd /path/to/project && node scripts/workspace-lifecycle.js cleanup
```

#### 4.2 清理过程

**Day 10（合并后 7 天）**:
```bash
$ node scripts/workspace-lifecycle.js cleanup

🧹 执行自动清理...

📊 当前工作区统计:
   🟢 Active: 12
   ⏸️ Paused: 3
   ✅ Completed: 2
   🎉 Merged: 5 (包含 T-024, T-025, T-026)
   📦 Archived: 18

📦 需要归档 (merged > 7天):
   - T-024 (merged 7天前)
   - T-025 (merged 7天前)
   - T-026 (merged 7天前)

执行归档:
   📦 T-024 已归档: archive/T-024-20260415.zip (2.1MB)
   📦 T-025 已归档: archive/T-025-20260415.zip (1.8MB)
   📦 T-026 已归档: archive/T-026-20260415.zip (0.5MB)

🗑️ 检查过期归档 (>3个月):
   - T-001-20260115.zip (已过期，删除)
   - T-002-20260120.zip (已过期，删除)

✅ 清理完成！
   释放磁盘空间: 156MB
   当前工作区: 17 个
   当前归档: 21 个
```

#### 4.3 归档后的目录结构

```
AGENTS/workspace/
├── T-027/                    # 🟢 进行中 (active)
├── T-028/                    # 🟢 进行中 (active)
├── T-029/                    # ⏸️ 暂停 (paused)
└── archive/                  # 📦 归档
    ├── T-020-20260301.zip
    ├── T-021-20260310.zip
    ├── T-022-20260320.zip
    ├── T-023-20260401.zip
    ├── T-024-20260415.zip    # ✅ 刚归档
    ├── T-025-20260415.zip
    └── T-026-20260415.zip
```

---

## 异常情况处理

### 场景 A: 开发过程中需求变更

```
用户: T-024 需要加上导出 CSV 格式

系统:
   选项 1: 在当前 Ticket 追加
   选项 2: 创建子 Ticket T-024-CSV
   
用户: 选项 2

系统:
   创建 T-024-CSV，依赖 T-024
   T-024 状态改为 paused
   等待 T-024-CSV 完成后继续
```

### 场景 B: 开发遇到阻塞

```
用户: T-025 需要等待后端数据库迁移，暂停

系统:
   node scripts/workspace-lifecycle.js status T-025 paused "等待数据库迁移"
   
   通知: T-025 已暂停，T-026 继续等待
   
用户: 数据库迁移完成，继续 T-025

系统:
   node scripts/workspace-lifecycle.js status T-025 active
```

### 场景 C: 需要恢复已归档的工作区

```
用户: 需要查看 T-024 的代码

系统:
   node scripts/workspace-lifecycle.js restore T-024
   
   📂 工作区 T-024 已恢复
   位置: AGENTS/workspace/T-024/
   状态: archived → restored
   
用户: /ticket T-024

系统:
   [加载 T-024 上下文]
   可以查看代码、历史提交等
```

---

## 命令速查表

| 阶段 | 命令 | 说明 |
|------|------|------|
| **开始** | `/plan <需求>` | 启动新需求，Orchestrator 规划 |
| **开发** | `/ticket <id>` | 切换到 Worker 模式执行 Ticket |
| **状态** | `/status <id> <state>` | 更新工作区状态 |
| **QA** | `/qa` 或 `/ticket <id>` | QA 审查 |
| **完成** | `/done <id>` | 标记完成 |
| **管理** | `/workspaces` | 列出所有工作区 |
| **恢复** | `/restore <id>` | 从归档恢复 |

---

## 总结

一个需求从进入到完成的完整流程:

1. **用户说需求** → `/plan 给我做 xxx`
2. **阿黄拆解** → 生成 2-3 个 Tickets，初始化工作区
3. **小花/阿铁开发** → `/ticket T-001` 并行开发
4. **阿镜验收** → `/ticket T-003` QA 审查
5. **自动合并** → 代码进入主仓库
6. **7天后归档** → 自动压缩，释放空间

整个流程 **全自动状态流转**，无需手动管理工作区！
