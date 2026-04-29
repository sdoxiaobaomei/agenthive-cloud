# Workspace 管理最佳实践

## 🎯 目标

避免 `AGENTS/workspace/` 目录无限制增长，导致：
- 磁盘空间爆炸（每个 node_modules ~500MB）
- VS Code 内存占用过高（文件监视器过载）
- 文件搜索缓慢

---

## 📁 目录结构规范

```
ai-digital-twin/
├── agenthive-cloud/              # 📦 主仓库（唯一完整 node_modules）
│   ├── apps/landing/node_modules
│   └── apps/web/node_modules
│
├── AGENTS/
│   └── workspace/               # 🗂️  Ticket 工作区
│       ├── T-001/              # 符号链接到主仓库的 node_modules
│       ├── T-002/
│       └── ... (保留最近10个)
│
└── archive/                     # 📦 归档目录（VS Code 已排除）
```

---

## 🚀 快速开始

### 1. 初始化新 Ticket 工作区

```bash
# 使用符号链接方式（推荐）
node scripts/init-workspace.js T-999

# 传统方式（复制所有文件，包括 node_modules）- 不推荐
# 会导致磁盘和内存爆炸
```

### 2. 手动清理旧工作区

```bash
# 清理所有旧工作区，只保留最近10个
node scripts/cleanup-workspaces.js
```

### 3. 安装 Git Hook（可选）

```bash
# 自动在切换分支后清理
Copy-Item scripts/hooks/post-checkout .git/hooks/
```

---

## ⚙️ VS Code 配置

已配置 `.vscode/settings.json`：

- ✅ 文件浏览器排除 `node_modules`
- ✅ 文件监视器排除 `AGENTS/workspace/**`
- ✅ 搜索排除归档目录
- ✅ 内存优化设置

---

## 📊 监控指标

定期检查：

```powershell
# 统计 node_modules 数量
Get-ChildItem -Path . -Filter "node_modules" -Recurse -Directory | Measure-Object

# 统计工作区数量
Get-ChildItem AGENTS/workspace -Directory | Measure-Object

# 查看 VS Code 内存占用
Get-Process -Name "Code" | Measure-Object -Property WorkingSet64 -Sum
```

---

## 🚨 警报阈值

| 指标 | 警告阈值 | 严重阈值 |
|------|----------|----------|
| node_modules 数量 | > 5 | > 10 |
| 工作区数量 | > 15 | > 30 |
| VS Code 内存 | > 2GB | > 4GB |

---

## 💡 进阶优化

### 使用 pnpm workspace（推荐）

如果项目规模继续扩大，考虑迁移到 pnpm workspace：

```yaml
# pnpm-workspace.yaml
packages:
  - 'agenthive-cloud/apps/*'
  - 'packages/*'
```

优势：
- 全局内容寻址存储（所有项目共享依赖）
- 硬链接节省磁盘空间
- 更快的安装速度

### 使用 Docker 隔离

为每个 Agent 创建独立的 Docker 容器：

```dockerfile
FROM node:20-alpine
WORKDIR /workspace
# 每个容器有自己的文件系统，不影响宿主机
```

---

## 📋 检查清单

- [ ] 创建新 ticket 时使用 `init-workspace.js`
- [ ] 每周运行一次 `cleanup-workspaces.js`
- [ ] 确认 `.vscode/settings.json` 已提交到 Git
- [ ] 监控磁盘空间使用情况
- [ ] 定期归档旧项目到 `archive/`

---

**记住：预防胜于治疗！定期清理比一次性清理 200K 文件要轻松得多。** 🧹
