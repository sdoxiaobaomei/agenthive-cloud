# AgentHive Cloud 文件分析

## 📁 目录结构检查

### 🔴 不应提交到 Git（大文件/生成文件）

| 路径 | 大小 | 类型 | 处理方式 |
|------|------|------|----------|
| `.git` | 大 | Git 元数据 | ✅ 已忽略 |
| `.playwright-mcp` | 大 | Playwright 缓存 | 添加到 .gitignore |
| `.pnpm-store` | 321 MB | pnpm 虚拟存储 | 添加到 .gitignore |
| `node_modules` | 337 MB | 依赖目录 | ✅ 已忽略 |
| `pnpm-lock.yaml` | 338 KB | Lock 文件 | ⚠️ 可选提交 |

### 🟢 必须提交（源代码）

| 路径 | 说明 |
|------|------|
| `apps/` | 应用程序代码（api, landing, agent-runtime, web）|
| `packages/` | 共享包（types）|
| `package.json` | 根 package 配置 |
| `pnpm-workspace.yaml` | Workspace 配置 |
| `.gitignore` | Git 忽略规则 |
| `README.md` | 项目说明 |
| `docs/` | 文档 |

### 🟡 配置文件（看情况）

| 路径 | 说明 | 建议 |
|------|------|------|
| `.env` | 本地环境（敏感）| ❌ 不提交，保持空或删除 |
| `.env.local` | 本地私有配置 | ❌ 不提交 |
| `.env.development` | 开发环境模板 | ✅ 提交 |
| `.env.example` | 环境示例 | ✅ 提交 |
| `.dockerignore` | Docker 忽略规则 | ✅ 提交 |
| `Dockerfile.api` | Docker 配置 | ✅ 提交 |

### 🔴 临时文件（应该删除）

| 路径 | 说明 | 操作 |
|------|------|------|
| `chat-*.png` | UI 测试截图（18个）| 🗑️ 删除 |
| `homepage-test.png` | 测试截图 | 🗑️ 删除 |
| `login-*.png` | 登录页截图 | 🗑️ 删除 |

---

## 📋 清理建议

### 1. 立即删除临时截图

```bash
# 删除所有截图文件
rm chat-*.png homepage-test.png login-*.png
```

### 2. 更新 .gitignore

确保以下内容已包含：

```gitignore
# 依赖
node_modules
.pnpm-store

# 本地环境（敏感）
.env
.env.local
.env.production

# 缓存
.playwright-mcp
.cache

# 测试截图
*.png
!assets/**/*.png
!public/**/*.png
```

### 3. 处理 pnpm-lock.yaml

**方案 A：提交 lockfile（推荐）**
- 确保确定性安装
- CI/CD 更稳定

**方案 B：不提交**
- 每次安装可能略有不同
- 适合快速原型

---

## 📊 提交前检查清单

```bash
# 检查大文件
find . -type f -size +1M | grep -v node_modules | grep -v .git

# 检查敏感信息
grep -r "password\|secret\|key" --include=".env*" .

# 检查临时文件
ls *.png 2>/dev/null
```

## ✅ 最终建议提交内容

```
apps/
├── api/
├── landing/
├── agent-runtime/
└── web/

packages/
└── types/

docs/
.gitignore
.dockerignore
package.json
pnpm-workspace.yaml
README.md
.env.example
.env.development
Dockerfile.api
apps/*/Dockerfile*
```

## 🗑️ 不应提交内容

```
.git/
node_modules/
.pnpm-store/
.playwright-mcp/
.env
.env.local
*.png（根目录的截图）
```
