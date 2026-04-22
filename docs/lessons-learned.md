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

### K8s 部署踩坑 (2026-04-22)

- **镜像缓存陷阱**: `latest` + `IfNotPresent` 导致节点永远使用旧镜像。必须设置 `imagePullPolicy: Always` 或使用显式版本标签。
- **ConfigMap 漂移**: 新增 key 到 ConfigMap 后，如果 Deployment 是逐个 `configMapKeyRef` 引用的，新 key 不会自动映射到容器环境变量。
- **Kustomize 数组合并**: Strategic Merge Patch 对同名数组元素会合并而非替换，导致 `Duplicate value` 错误。
- **证书与 DNS 先行**: cert-manager 的 HTTP01 challenge 要求域名 DNS 先解析到 Ingress SLB，否则验证会循环失败。
- **CORS 浏览器缓存**: 浏览器会缓存失败的 OPTIONS 预检响应，服务端修复后需强制刷新 (Ctrl+Shift+R)。
- **Dist 构建遗忘**: Dockerfile 采用"预构建 dist"模式时，修改 src 后必须先本地 `npm run build`，否则 docker build 复制的是旧 dist。

---

_最后更新: 2026-04-22_
