// Tools Index - 统一工具导出
// 使用增强版工具系统

export {
  // 核心类型
  Tool,
  ToolDef,
  ToolContext,
  PermissionDecision,
  ToolProgress,
  ToolResult,
  ToolMetadata,
  ToolCall,
  ToolExecutionResult,
  
  // 核心类
  ToolRegistry,
  ToolExecutor,
  
  // 工厂函数
  buildTool,
  
  // 全局实例
  globalToolRegistry
} from './ToolEnhanced.js'

export {
  // 协调器
  ToolOrchestrator,
  OrchestratorConfig,
  ToolBatch,
  ToolExecutionProgress,
  isReadOperation,
  isDestructiveOperation,
  createToolOrchestrator
} from './ToolOrchestrator.js'

// 文件工具
export { FileReadTool } from './file/FileReadTool.js'
export { FileWriteTool } from './file/FileWriteTool.js'
export { FileEditTool } from './file/FileEditTool.js'

// 搜索工具
export { GrepTool } from './search/GrepTool.js'

// Shell 工具
export { BashTool } from './shell/BashTool.js'

// Agent 工具
export {
  AgentTool,
  SubAgentManager,
  initializeSubAgentManager,
  getSubAgentManager,
  BUILTIN_AGENTS,
  AgentType,
  AgentDefinition,
  AgentTask,
  AgentResult,
  SubAgent
} from './agent/AgentToolEnhanced.js'

// ============================================================================
// 工具注册辅助函数
// ============================================================================

import { ToolRegistry } from './ToolEnhanced.js'
import { FileReadTool } from './file/FileReadTool.js'
import { FileWriteTool } from './file/FileWriteTool.js'
import { FileEditTool } from './file/FileEditTool.js'
import { GrepTool } from './search/GrepTool.js'
import { BashTool } from './shell/BashTool.js'
import { AgentTool } from './agent/AgentToolEnhanced.js'

/**
 * 注册所有标准工具到注册表
 */
export function registerStandardTools(registry: ToolRegistry = new ToolRegistry()): ToolRegistry {
  // 文件操作工具
  registry.register(FileReadTool)
  registry.register(FileWriteTool)
  registry.register(FileEditTool)
  
  // 搜索工具
  registry.register(GrepTool)
  
  // Shell 工具
  registry.register(BashTool)
  
  // Agent 工具
  registry.register(AgentTool)
  
  return registry
}

/**
 * 创建标准工具注册表（包含所有标准工具）
 */
export function createStandardToolRegistry(): ToolRegistry {
  return registerStandardTools()
}
