# 项目经验教训

## 🔥 重大事件

### Workspace 爆炸 (2026-04-05)
- **现象**: VS Code 内存 2.8GB，严重卡顿
- **原因**: 30 个 ticket × 完整 node_modules 副本 = 170 万文件
- **解决**: 符号链接方案 + 定期清理
- **教训**: "复制是万恶之源。共享和链接才是正道。"

### Landing SSR 错误
- **现象**: `Cannot read properties of undefined (reading 'addEventListener')`
- **原因**: SSR 时 `window` 不存在
- **解决**: 使用 `if (import.meta.client)` 包裹客户端代码
- **教训**: SSR 不是免费的，每个插件都要考虑服务端环境

### Store 依赖地狱
- **现象**: `Failed to resolve import "pinia"`
- **原因**: landing/package.json 缺少依赖声明
- **解决**: 每个子项目明确声明所有依赖
- **教训**: 依赖不是自动继承的

---

## 🏗️ 架构教训

| 问题 | 影响 | 建议 |
|------|------|------|
| 技术栈分裂 | Landing (Nuxt SSR) vs Web (Vite SPA) 增加复杂度 | 统一技术栈 |
| 类型定义冲突 | UI 和 Domain 同名类型 | 使用命名空间区分 |
| 路径地狱 | `../../../../packages/...` | 使用 Path Mapping |

---

## 🛠️ 工具链推荐

1. **pnpm Workspace** - 全局存储 + 硬链接，节省 90% 磁盘
2. **Changesets** - 版本发布管理
3. **Turborepo** - 构建加速

---

## 💡 团队格言

1. "如果一件事需要手动做两次，就自动化它。"
2. "复制代码是债务，共享代码是资产。"
3. "今天偷的懒，明天双倍还。"
4. "文档写得越多，解释得越少。"

---

_最后更新: 2026-04-06_
