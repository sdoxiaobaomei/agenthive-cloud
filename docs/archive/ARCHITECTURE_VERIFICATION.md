# 架构验证文档

> **验证日期**: 2026-04-06  
> **目的**: 确认实际项目架构，纠正设计文档

---

## 实际项目结构 (已验证)

```
ai-digital-twin/
├── agenthive-cloud/
│   └── apps/
│       ├── landing/          ✅ Nuxt 3 (SSR)
│       ├── api/              ✅ Express (Node.js)
│       └── agent-runtime/    ✅ Node.js + WebSocket
│
└── AGENTS/                   # AI Agent 控制中心 (独立)
    ├── orchestrator.ts
    └── workers/
```

### 验证命令

```powershell
# 实际执行的验证命令
Get-ChildItem agenthive-cloud/apps/

# 输出:
# - agent-runtime  (目录)
# - api            (目录)
# - landing        (目录)
```

---

## 服务清单

| 服务 | 技术栈 | 端口 | 用途 | 状态 |
|------|--------|------|------|------|
| **landing** | Nuxt 3 + Vue 3 | 3000 | 营销站 + Web App | ✅ 存在 |
| **api** | Express + TypeScript | 3001 | REST API | ✅ 存在 |
| **agent-runtime** | Node.js + WebSocket | 8080 | AI Agent 执行 | ✅ 存在 |
| ~~web~~ | - | - | ~~独立 Web App~~ | ❌ **已合并到 landing** |

---

## 纠正说明

### 之前的误解

在设计文档中，我错误地假设了以下架构：
```
❌ 错误假设:
├── landing/       # 纯营销站
├── web/           # 独立 Web App  <-- 实际不存在
├── api/
└── agent-runtime/
```

### 正确架构

```
✅ 实际架构:
├── landing/       # Nuxt 3 (营销站 + Web App 合并)
├── api/           # Express 后端
└── agent-runtime/ # AI Agent 运行时
```

**证据来源**:
1. `agenthive-cloud/apps/` 目录只有 3 个子目录
2. `AGENTS.md` 中提到 "Web (已合并到 landing)"
3. Landing 的 `pages/` 目录包含完整的应用路由

---

## 更新后的资源计算

| 服务 | 修正前 (假设有 web) | 修正后 (实际) | 变化 |
|------|-------------------|--------------|------|
| landing | 100 MB | 200 MB | +100 MB (SSR) |
| web | 150 MB | 0 MB | -150 MB (不存在) |
| api | 200 MB | 200 MB | 不变 |
| agent-runtime | 300 MB | 300 MB | 不变 |
| nginx | 20 MB | 20 MB | 不变 |
| postgres | 200 MB | 200 MB | 不变 |
| redis | 30 MB | 30 MB | 不变 |
| **总计** | ~1.0 GB | ~0.95 GB | **略降** |

---

## 部署影响

### Docker Compose 修正

```yaml
# 修正前 (错误)
services:
  landing:        # 静态文件
  web:            # ❌ 不存在
  api:
  agent-runtime:

# 修正后 (正确)
services:
  landing:        # Nuxt 3 SSR
  api:
  agent-runtime:
```

### Nginx 路由修正

```nginx
# 修正前 (错误)
location / {
    root /usr/share/nginx/html/landing;  # 静态
}
location /app {
    root /usr/share/nginx/html/web;      # ❌ 不存在
}

# 修正后 (正确)
location / {
    proxy_pass http://landing;  # SSR 代理到 Nuxt
}
```

---

## 文档更新状态

| 文档 | 状态 | 说明 |
|------|------|------|
| `single-ecs-plan.md` | ✅ 已更新 | 移除 web 服务，修正 landing 为 SSR |
| `deployment-plan/README.md` | ⚠️ 需更新 | 还有 web 应用引用 |
| Control Center 设计 | ⚠️ 需更新 | 基于错误架构设计 |

---

## 建议

1. **Landing 应用** 实际上是 **全栈应用** (Frontend + SSR)
   - 不要将其视为纯静态站点
   - 需要 Node.js 运行时
   - 内存需求比纯静态高

2. **不需要单独的 Web 应用部署**
   - 所有功能已在 landing 中
   - 简化了部署架构
   - 降低了成本

3. **API 职责**
   - REST API
   - WebSocket 代理
   - 与 Agent Runtime 通信

---

## 下一步行动

- [x] 验证实际项目结构
- [x] 更新单 ECS 部署方案
- [ ] 更新主部署计划文档
- [ ] 更新 Control Center 设计 (如果需要)
- [ ] 删除所有对 "web" 应用的引用
