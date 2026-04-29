# Frontend Agent — Procedural Memory / Skills

可复用的 Vue 3/Nuxt 3 开发模式、组件模板、问题解决方案。

## 目录结构

```
skills/frontend/
├── README.md                 # 本文件（索引）
├── official/                 # 已验证的、可复用的技能
│   └── patterns/             # 代码模式与最佳实践
├── draft/                    # 候选技能，考察期 30 天
└── retired/                  # 已淘汰（技术栈变更导致过时）
```

## 当前技能库

### official/patterns/（已验证）

- `composition-api.md` — Vue Composition API 规范
- `e2e-testing.md` — E2E 测试模式
- `nuxt-bff-proxy.md` — Nuxt BFF 代理模式
- `performance-optimization.md` — 性能优化策略
- `pinia-setup-store.md` — Pinia Setup Store 模板
- `ssr-safety.md` — SSR 安全实践
- `iframe-sandbox-preview.md` — iframe sandbox 安全预览模式（TICKET-FE-MKT-001/007）
- `monaco-editor-dynamic-import.md` — Monaco Editor 动态导入（TICKET-FEAT-006b）
- `landing-vitest-playwright-setup.md` — Landing 测试基础设施（TICKET-FE-MKT-003/007）

### draft/（考察中，30天）

- `dark-mode-form-card-styling.md` — 暗色模式表单卡片样式
- `economy-mock-composable-pattern.md` — 经济系统 Mock Composable 模式

## 添加新技能（最小可行流程）

当任务中发现新的可复用模式时：

1. **任务完成后**， Specialist 在 reflection 中标记 `skill_candidate: true`
2. **Lead 审查时**，若认可该模式的价值，指令 Specialist 写入 `draft/`
3. **30 天内**：若该 draft 被引用/使用 ≥ 1 次，Lead 将其移至 `official/`
4. **30 天后**：若无人引用，Lead 决定是否删除或归档至 `retired/`

> ⚠️ 注意：当前不支持自动 Curator 写入。所有 skill 新增需经 Lead 审查后手动/指令写入。
