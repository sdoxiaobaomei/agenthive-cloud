# Agent Runtime 文档

> 欢迎来到 Agent Runtime 文档中心

---

## 📚 文档目录

### 入门指南

- [API 文档](API.md) - 完整的 API 参考和使用示例
- [架构文档](ARCHITECTURE.md) - 系统架构和设计决策
- [快速参考](QUICK_REFERENCE.md) - 常用代码片段速查
- [迁移指南](guides/MIGRATION_GUIDE.md) - 从旧版本迁移的详细步骤
- [Ollama 本地部署](guides/README-OLLAMA.md) - Ollama 本地模型配置

### 项目信息

- [CHANGELOG](../CHANGELOG.md) - 版本变更历史
- [PROGRESS](../PROGRESS.md) - 开发进度追踪 (v2.2.0)
- [MIGRATION_PLAN](../MIGRATION_PLAN.md) - 完整的迁移计划

### 归档文档

- [archive/](archive/) - 历史文档和过时资料

---

## 🚀 快速开始

### 安装

```bash
npm install @agenthive/agent-runtime
```

### 基础用法

```typescript
import { 
  buildToolV2, 
  ToolRegistryV2,
  FEATURE_FLAGS 
} from '@agenthive/agent-runtime'

// 启用新功能（可选）
FEATURE_FLAGS.USE_TOOL_V2 = true

// 创建工具
const myTool = buildToolV2({
  name: 'hello',
  description: 'Say hello',
  inputSchema: z.object({ name: z.string() }),
  call: async (input) => ({
    data: `Hello, ${input.name}!`,
    type: 'result'
  })
})

// 注册并使用
const registry = new ToolRegistryV2()
registry.register(myTool)
```

---

## 🏗️ 架构概览

```
Agent Runtime
├── Tool System V2      # 新一代工具接口
│   ├── ToolV2          # 核心接口
│   ├── ToolRegistryV2  # 注册表
│   └── Adapter         # 向后兼容
├── Agent System        # Agent 管理
│   ├── AgentManager    # 主管理器
│   ├── SubAgent        # 子代理
│   └── Team            # 团队协作
├── Query Loop          # 查询循环
│   ├── Context V2      # 上下文管理
│   └── Compaction      # 压缩策略
├── Permission System   # 权限系统
│   ├── Rules           # 规则引擎
│   └── AutoClassifier  # 自动分类
└── MCP Integration     # MCP 集成
```

---

## 📖 核心概念

### ToolV2 接口

基于 Claude Code 设计的新一代工具接口，提供：
- 完整的权限控制
- 流式进度反馈
- 统一的上下文管理
- MCP 原生支持

### 适配器层

提供新旧接口的双向转换：
- `adaptLegacyToV2()` - 升级旧工具
- `adaptV2ToLegacy()` - 降级新工具
- 100% 向后兼容

### 功能开关

渐进式启用新功能：
```typescript
import { enableFeature } from '@agenthive/agent-runtime'

enableFeature('USE_TOOL_V2')
enableFeature('ENABLE_CONTEXT_COMPRESSION')
```

---

## 🛠️ 开发指南

### 创建自定义工具

```typescript
const customTool = buildToolV2({
  name: 'my_tool',
  category: 'read',
  inputSchema: z.object({ path: z.string() }),
  
  call: async (input, context, canUseTool, assistantMessage, onProgress) => {
    // 权限检查
    const permission = await canUseTool('my_tool', input)
    if (permission.behavior === 'deny') {
      return { data: null, error: 'Denied', type: 'error' }
    }
    
    // 进度反馈
    onProgress?.({ type: 'start', message: 'Processing...' })
    
    // 执行操作
    const result = await doSomething(input.path)
    
    return {
      data: result,
      type: 'result',
      resultForAssistant: `Result: ${JSON.stringify(result)}`
    }
  },
  
  isReadOnly: () => true,
  isConcurrencySafe: () => true
})
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- tests/unit/ToolV2.test.ts

# 带覆盖率
npm test -- --coverage
```

---

## 📋 版本信息

- **当前版本**: 2.2.0
- **Node.js 要求**: >= 18.0.0
- **TypeScript**: 5.3+

---

## 🤝 贡献

请参考 [MIGRATION_PLAN](../MIGRATION_PLAN.md) 了解当前开发计划。

---

## 📄 License

MIT
