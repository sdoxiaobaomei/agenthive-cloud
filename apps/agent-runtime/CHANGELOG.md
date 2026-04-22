# Changelog

所有显著的变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [2.3.0] - 2026-04-22

> **目标读者**：前端工程师、DevOps 工程师、API 维护者  
> **适用范围**：`apps/agent-runtime` - AgentHive Agent Runtime 服务

### 目录

- [架构变更](#架构变更)
- [对 Supervisor（API）的影响](#对-supervisorapi-的影响)

---

### 架构变更

#### 新增 `BaseAgentRuntime<TConfig>` 抽象基类

- **变更内容**：新增 `BaseAgentRuntime<TConfig>` 抽象基类，V1/V2/V3 统一继承自该基类
- **文件位置**：`src/services/BaseAgentRuntime.ts`
- **核心能力**：
  - 统一的 Agent 生命周期管理（`start()` / `stop()` / `pause()` / `resume()`）
  - 标准化的 WebSocket 连接与心跳机制
  - 文件系统服务初始化
  - 命令执行分发（`run_task` / `cancel_task` / `pause` / `resume` / `shutdown`）
  - 优雅的关闭流程（等待任务完成、清理心跳定时器）
- **子类需实现**：
  - `getRuntimeName()` - 运行时名称
  - `getAvailableTools()` - 可用工具列表
  - `getRegisterCapabilities()` - 注册能力列表
  - `handleRunTask(task)` - 任务执行逻辑
  - `handleCancelTask()` - 任务取消逻辑
  - `getExecutorManager()` - 执行器管理器
- **子类可扩展**：
  - `getRegisterExtraFields()` - 注册时附加字段
  - `getHeartbeatExtraFields()` - 心跳时附加字段
  - `afterStart()` / `beforeDisconnect()` - 生命周期钩子

#### 上下文压缩真正生效

- **变更内容**：`applyCompactionResult` 不再为空实现，上下文压缩策略（Snip/Compact/Collapse）真正生效
- **影响**：
  - 长对话场景下内存占用显著降低
  - Token 消耗更加可控
  - 建议监控 `memory` 字段的变化

#### LLM 缓存键升级为 SHA-256

- **变更内容**：LLM 缓存键从简单哈希算法改为 **SHA-256**
- **影响**：
  - 缓存碰撞概率大幅降低
  - 缓存命中率更加稳定
  - 对前端/API 透明

#### QueryLoopV2 集成 PermissionManager

- **变更内容**：`QueryLoopV2` 真正集成 `PermissionManager`，工具调用前执行权限校验
- **影响**：
  - 工具调用安全性提升
  - 未授权工具将被拦截并返回错误
  - 可通过权限配置精细化控制 Agent 能力

---

### 对 Supervisor（API）的影响

#### Agent 注册字段扩展

- **变更内容**：Agent 注册时，V3 会额外上报 `model` 字段
- **事件**：`agent:register`
- **Payload 变化**：
  ```json
  {
    "id": "agent-001",
    "name": "Frontend Dev",
    "role": "frontend-dev",
    "capabilities": ["vue", "typescript"],
    "status": "idle",
    "tools": ["file-read", "file-write"],
    "model": "gpt-4"  // ← V3 新增
  }
  ```
- **API 注意**：Supervisor 接收端应兼容该字段的缺失（V1/V2 不携带）

#### 心跳消息字段扩展

- **变更内容**：心跳消息中 V2/V3 会额外上报 `tools` 和 `model` 字段
- **事件**：`agent:heartbeat`
- **Payload 变化**：
  ```json
  {
    "agentId": "agent-001",
    "status": "working",
    "currentTask": "task-123",
    "progress": 45,
    "memory": 128,
    "cpu": 0,
    "tools": ["file-read", "file-write"],  // ← V2/V3 新增
    "model": "gpt-4"                       // ← V2/V3 新增
  }
  ```
- **前端注意**：心跳面板可展示当前 Agent 使用的模型和工具集

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

### 从 2.2.0 升级到 2.3.0

1. **更新依赖**
   ```bash
   npm update @agenthive/agent-runtime
   ```

2. **验证 Supervisor 兼容性**
   - 确认 API 服务能正确解析 `agent:register` 和 `agent:heartbeat` 中的新增字段
   - 旧版 Supervisor 可安全忽略未知字段

3. **监控上下文压缩效果**
   - 观察 Agent 内存占用变化
   - 检查长任务场景下的 Token 消耗

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

[2.3.0]: https://github.com/agenthive/agent-runtime/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/agenthive/agent-runtime/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/agenthive/agent-runtime/releases/tag/v2.1.0
