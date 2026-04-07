# Agent Runtime 架构文档

> 描述 Agent Runtime 的系统架构和设计决策

---

## 目录

- [系统概览](#系统概览)
- [架构图](#架构图)
- [核心组件](#核心组件)
- [设计决策](#设计决策)
- [数据流](#数据流)
- [扩展点](#扩展点)

---

## 系统概览

Agent Runtime 是一个基于 Node.js 的 AI Agent 执行环境，采用模块化、事件驱动的架构设计。

### 主要特性

- **多 Agent 支持**: 支持子 Agent 创建和并行执行
- **工具系统**: 灵活的工具注册和执行机制
- **权限控制**: 细粒度的权限管理和审计
- **上下文管理**: 智能的上下文压缩和状态管理
- **MCP 集成**: 支持 Model Context Protocol

---

## 架构图

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Runtime                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Tool System                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │   │
│  │  │   ToolV2     │  │ToolRegistryV2│  │  Adapter  │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────┼─────────────────────────────┐   │
│  │                       ▼                             │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │              Agent System                    │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │   │
│  │  │  │AgentTask │  │SubAgent  │  │  Team    │  │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────┼─────────────────────────────┐   │
│  │                       ▼                             │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │              Query Loop                      │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │   │
│  │  │  │ContextV2 │  │Compaction│  │  LLM     │  │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Permission System                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │  Rules   │  │Classifier│  │  Hooks   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Infrastructure                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │  Logger  │  │  Config  │  │   MCP    │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 工具系统架构

```
ToolV2 Interface
       │
       ├── call(input, context, canUseTool, assistantMessage, onProgress)
       │      │
       │      ▼
       │  ┌─────────────────────────────┐
       │  │  1. 权限检查 (canUseTool)    │
       │  │  2. 进度回调 (onProgress)    │
       │  │  3. 执行操作                 │
       │  │  4. 返回结果 (ToolResult)    │
       │  └─────────────────────────────┘
       │
       ├── checkPermissions(input, context)
       │
       ├── isReadOnly(input) ──────┬──► 并发优化
       ├── isConcurrencySafe(input)─┘
       │
       └── isDestructive?(input) ───► 权限决策
```

---

## 核心组件

### 1. ToolV2 接口

**职责**: 定义工具的标准接口

**关键设计**:
- `call()`: 核心执行方法，包含完整的上下文
- `checkPermissions()`: 权限检查点
- `isReadOnly()`: 声明式权限标记
- `onProgress`: 流式进度反馈

**为什么这样设计**:
- 参考 Claude Code 的实现经验
- 支持流式输出和进度反馈
- 细粒度的权限控制

### 2. ToolRegistryV2

**职责**: 工具的统一管理

**关键特性**:
- 别名映射: 支持工具别名
- 分类管理: 按类别组织工具
- 延迟加载: 优化启动性能
- MCP 支持: 外部工具集成

**数据结构**:
```typescript
class ToolRegistryV2 {
  tools: Map<string, ToolV2>        // 主存储
  aliasMap: Map<string, string>     // 别名 -> 主名
  categoryMap: Map<Category, Set>   // 分类索引
  deferredTools: Set<string>        // 延迟加载集合
}
```

### 3. 适配器层

**职责**: 新旧接口的桥接

**设计模式**: Adapter Pattern

**为什么需要**:
- 向后兼容: 现有代码无需修改
- 渐进迁移: 可以逐个工具升级
- 风险控制: 出现问题可快速回滚

### 4. 功能开关

**职责**: 运行时功能控制

**实现**:
```typescript
const FEATURE_FLAGS = {
  USE_TOOL_V2: process.env.AGENT_USE_TOOL_V2 === 'true',
  // ...
}
```

**用途**:
- A/B 测试
- 灰度发布
- 紧急回滚

---

## 设计决策

### 决策 1: 为什么创建 ToolV2 而不是修改现有 Tool？

**选项 A**: 直接修改现有 Tool 接口
- ✅ 简单直接
- ❌ 破坏性变更，需要修改所有现有代码
- ❌ 风险高，一旦出错影响范围广

**选项 B**: 创建新 ToolV2 接口 + 适配器（✅ 选择）
- ✅ 100% 向后兼容
- ✅ 可以渐进式迁移
- ✅ 新旧代码可以共存
- ✅ 风险可控

### 决策 2: 为什么使用 call() 而不是 execute()？

**Claude Code 风格**:
```typescript
// 旧接口
tool.execute(input, context) -> Promise<Output>

// 新接口  
tool.call(
  input,
  context,
  canUseTool,        // 权限检查函数
  assistantMessage,  // 关联的助手消息
  onProgress         // 进度回调
) -> Promise<ToolResult<Output>>
```

**优势**:
- 权限检查是显式的，不是隐式的
- 支持流式进度反馈
- 结果包含更多元数据

### 决策 3: 为什么需要 ToolUseContext？

**上下文包含**:
- 应用状态管理 (`getAppState`, `setAppState`)
- 日志输出 (`sendLog`)
- 中止控制 (`abortController`)
- LLM 服务 (`llm.complete`, `llm.stream`)

**好处**:
- 工具可以访问完整上下文
- 支持更复杂的交互模式
- 无需全局状态

### 决策 4: 为什么需要延迟加载？

**场景**:
- MCP 工具可能很多
- 某些工具初始化开销大
- 按需加载提高启动速度

**实现**:
```typescript
interface ToolV2 {
  shouldDefer?: boolean    // 是否延迟加载
  alwaysLoad?: boolean     // 是否始终加载
}
```

---

## 数据流

### 工具调用流程

```
用户请求
    │
    ▼
┌─────────────────┐
│  解析工具调用    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  检查工具是否存在 │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  检查权限       │◄── canUseTool()
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  执行工具       │◄── call()
│  - 进度反馈      │   onProgress()
│  - 日志输出      │   sendLog()
│  - 中止检查      │   abortController
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  返回结果       │──► ToolResult
└─────────────────┘
```

### 适配器数据流

```
旧系统                    适配器层                    新系统
──────                    ────────                    ──────
  │                          │                          │
  │  tool.execute()          │                          │
  │────────────────────────►│                          │
  │                          │  转换参数                 │
  │                          │  创建 canUseTool         │
  │                          │  创建 onProgress         │
  │                          │                          │
  │                          │  tool.call()             │
  │                          │────────────────────────►│
  │                          │                          │
  │                          │  ToolResult              │
  │                          │◄────────────────────────│
  │                          │                          │
  │  Output                  │  转换结果                 │
  │◄────────────────────────│                          │
```

---

## 扩展点

### 1. 自定义工具

```typescript
const customTool = buildToolV2({
  name: 'my_tool',
  // 实现所需接口...
})

registry.register(customTool)
```

### 2. 自定义权限检查

```typescript
tool.call: async (input, context, canUseTool) => {
  // 自定义权限逻辑
  const permission = await myCustomPermissionCheck(input)
  
  if (!permission.allowed) {
    return createToolError('Custom permission denied')
  }
  
  // ...
}
```

### 3. 自定义进度反馈

```typescript
tool.call: async (input, context, canUseTool, assistantMessage, onProgress) => {
  for (let i = 0; i < steps.length; i++) {
    onProgress?.({
      type: 'step',
      progress: (i / steps.length) * 100,
      message: `Step ${i + 1}/${steps.length}`
    })
    
    await processStep(steps[i])
  }
}
```

### 4. MCP 扩展

```typescript
const mcpTool = buildToolV2({
  name: 'custom_mcp__server__tool',
  isMcp: true,
  mcpInfo: { serverName: 'custom', toolName: 'tool' },
  // ...
})
```

---

## 性能考虑

### 启动优化

- **延迟加载**: 不常用工具按需加载
- **Schema 缓存**: `lazySchema` 缓存解析后的 schema
- **注册表索引**: 多维度索引加速查询

### 运行时优化

- **并发安全工具**: 识别可并发的读取操作
- **结果缓存**: 权限检查缓存
- **流式输出**: 减少内存占用

### 内存管理

- **上下文清理**: 任务完成后清理上下文
- **注册表清理**: 支持 `unregister()` 释放资源

---

## 安全考虑

### 权限控制

- 声明式权限标记 (`isReadOnly`, `isDestructive`)
- 运行时权限检查 (`canUseTool`)
- 审计日志记录

### 隔离

- 子 Agent 隔离模式 (worktree/tempdir/container)
- 上下文隔离
- 资源限制

### 输入验证

- Zod Schema 验证
- 类型安全

---

## 参考

- [API 文档](API.md)
- [CHANGELOG](../CHANGELOG.md)
- [源码](../src/)
