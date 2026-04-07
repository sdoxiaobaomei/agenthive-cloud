# Changelog

所有显著的变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [2.2.0] - 2026-04-06

### 🚀 新增功能

#### ToolV2 接口
- 基于 Claude Code 设计的新一代工具接口
- 完整的 `call()` 方法，支持权限检查、进度回调
- 统一的 `ToolUseContext` 上下文管理
- MCP 工具属性支持 (`isMcp`, `mcpInfo`)
- 延迟加载 Schema 支持 (`lazySchema`)

#### ToolRegistryV2
- 支持 ToolV2 接口的全新注册表
- 别名映射管理
- 工具分类管理 (`read`, `write`, `execute` 等)
- 延迟加载支持 (`shouldDefer`, `alwaysLoad`)
- MCP 工具管理
- 智能搜索功能 (`searchByHint`, `searchForTask`)

#### 适配器层
- 新旧 Tool 接口的双向转换
- `adaptLegacyToV2()`: 旧工具升级
- `adaptV2ToLegacy()`: 新工具降级（向后兼容）
- 批量转换支持

#### 功能开关系统
- 环境变量驱动的功能开关
- 运行时启用/禁用功能
- 支持渐进式迁移

### 🔧 改进

- **向后兼容**: 100% 向后兼容，现有代码无需修改
- **类型安全**: 完整的 TypeScript 类型定义
- **测试覆盖**: 新增 69 个测试，总计 106 个测试
- **性能**: 延迟加载 Schema 减少启动开销

### 📚 文档

- 新增完整的 API 文档
- 新增迁移指南
- 新增最佳实践说明

### 📊 统计

```
新增代码: ~1,800 行
新增测试: 69 个
测试总数: 106 个
测试通过率: 100%
覆盖率: >85%
```

---

## [2.1.0] - 2026-04-05

### 基础版本

- Agent System 核心实现
- Permission Manager 权限管理
- Tool System 工具系统
- SubAgent 子代理支持
- WebSocket 通信
- MCP 基础客户端

---

## 升级指南

### 从 2.1.0 升级到 2.2.0

1. **更新依赖**
   ```bash
   npm update @agenthive/agent-runtime
   ```

2. **可选：启用新功能**
   ```bash
   export AGENT_USE_TOOL_V2=true
   ```

3. **使用适配器（推荐）**
   ```typescript
   import { adaptLegacyToV2 } from '@agenthive/agent-runtime'
   
   // 旧工具自动升级
   const modernTool = adaptLegacyToV2(legacyTool)
   ```

4. **完整迁移（可选）**
   参考 [迁移指南](docs/API.md#迁移指南)

---

## 未发布

### 计划中

- [ ] QueryLoopV2 重构
- [ ] 上下文压缩策略 (Snip/Compact/Collapse)
- [ ] Agent 隔离模式 (Worktree/TempDir)
- [ ] AutoClassifier 实现
- [ ] MCP 完整集成
- [ ] 团队协作模式

---

[2.2.0]: https://github.com/agenthive/agent-runtime/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/agenthive/agent-runtime/releases/tag/v2.1.0
