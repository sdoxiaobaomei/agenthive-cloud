# Changelog

所有显著变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)。

## [Unreleased]

### Planned
- Phase 3: Agent Isolation Modes (Worktree/Remote/Container)
- Phase 4: MCP Minimal Integration + AutoClassifier
- Phase 5: Validation & Migration

---

## [2.2.0] - 2026-04-06

### Added - Phase 2: QueryLoopV2 + Context Compression

#### QueryLoopV2
- 全新的对话循环实现，参考 Claude Code 设计
- 完整的状态机管理（idle/running/compacting/tool_executing/completed/error/stopped）
- 中止控制支持（AbortController）
- 流式执行支持（AsyncGenerator）
- 进度回调和 EventEmitter 事件系统
- 压缩统计（compactionCount, tokensSaved）
- 执行时间跟踪
- 与 ToolV2 原生集成

#### Context Compression Engine
- 三级压缩策略：
  - **Snip Compaction**: 简单消息移除，保留首尾消息
  - **Compact Conversation**: 摘要压缩，使用 LLM 生成摘要
  - **Context Collapse**: 完全折叠，保留系统消息和完整摘要
- 智能策略选择（基于 token 数量自动选择）
- 可配置的压缩阈值
- SimpleTokenEstimator 用于 token 估算
- 支持自定义压缩策略

#### QueryLoopFactory
- 统一的 QueryLoop 创建入口
- 根据特性标志自动选择实现（QueryLoop vs QueryLoopV2）
- 旧版适配器支持

#### 测试
- 新增 38 个测试用例
  - QueryLoopV2: 18 个测试
  - CompactionEngine: 20 个测试
- 总测试数达到 144 个
- 所有测试通过 ✅

---

## [2.1.0] - 2026-04-06

### Added - Phase 1: ToolV2 Interface + Adapter Layer

#### ToolV2 Interface
- 全新的工具接口，参考 Claude Code 设计
- `call()` 方法替代 `execute()`，支持进度回调
- 权限检查集成（`checkPermissions`）
- 只读/破坏性操作标记
- 并发安全标记
- 延迟 Schema 初始化（`lazySchema`）
- MCP 元数据支持

#### Tool Adapter Layer
- 双向适配器支持：
  - `adaptLegacyToV2()`: 旧工具包装为新接口
  - `adaptV2ToLegacy()`: 新工具降级为旧接口
- 类型守卫函数（`isToolV2`, `isLegacyTool`）
- 100% 向后兼容

#### ToolRegistryV2
- 别名管理系统
- 工具分类支持
- MCP 工具支持
- 懒加载工具分离
- 基于任务的智能搜索
- LLM 函数定义生成

#### Feature Flags
- 环境变量驱动的特性开关
- 支持标志：
  - `USE_TOOL_V2`
  - `USE_QUERY_LOOP_V2`
  - `ENABLE_AUTO_CLASSIFIER`
  - `ENABLE_MCP`
  - `ENABLE_WORKTREE_ISOLATION`
- 运行时启用/禁用功能

#### 文档
- API.md - API 使用指南
- ARCHITECTURE.md - 架构文档
- QUICK_REFERENCE.md - 快速参考
- README.md - 项目概述
- PROGRESS.md - 进度文档

#### 测试
- 69 个新测试用例
- 总测试数达到 106 个
- 覆盖率：
  - ToolV2: 99.58%
  - ToolAdapter: 100%
  - ToolRegistryV2: 88.93%

---

## [2.0.0] - 2026-04-05

### Added
- 初始版本
- Agent Runtime 核心功能
- 基础工具系统
- Query Loop 实现
- Permission Manager
- Conversation Context

---

## 迁移指南

### 从旧版 Tool 迁移到 ToolV2

```typescript
// 旧版
const legacyTool = {
  name: 'my_tool',
  execute: async (input, context) => {
    return result
  }
}

// 新版
const modernTool = buildToolV2({
  name: 'my_tool',
  inputSchema: z.object({...}),
  async call(input, context, canUseTool) {
    const permission = await canUseTool(this.name, input)
    if (permission.behavior === 'deny') {
      return createToolError('Denied')
    }
    return createToolResult(result)
  }
})
```

### 启用 QueryLoopV2

```typescript
// 设置环境变量
process.env.AGENT_USE_QUERY_LOOP_V2 = 'true'

// 或使用特性标志
enableFeature('USE_QUERY_LOOP_V2')

// 创建 QueryLoop
const loop = createQueryLoop({
  llmService,
  toolRegistry,
  compactionEngine, // 可选
  enableCompaction: true
})
```

---

*最后更新: 2026-04-06*
