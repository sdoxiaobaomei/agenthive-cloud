// Tools Index - 统一工具导出
// 支持新旧两套工具系统，确保向后兼容

// ============================================================================
// ToolV2 (新接口 - Claude Code 风格)
// ============================================================================

export {
  // 核心类型
  ToolV2,
  ToolV2Def,
  ToolUseContext,
  PermissionResult,
  ClassifierResult,
  PermissionBehavior,
  ToolCategory,
  ToolProgressData,
  ToolProgressCallback,
  ToolResult,
  Message,
  ToolCall,
  AssistantMessage,
  AppState,
  QueryChainTracking,
  ContentReplacementState,
  MCPServerConnection,
  LLMResult,
  LLMStreamChunk,
  CanUseToolFn,
  LazySchema,
  
  // Schema 工具
  lazySchema,
  isLazySchema,
  resolveSchema,
  
  // 工厂函数
  buildToolV2,
  
  // 结果辅助函数
  createToolResult,
  createToolError,
  createToolCancelled,
  
  // 类型守卫
  isToolV2,
  isToolResultError,
  isToolResultCancelled
} from './ToolV2.js'

// ============================================================================
// ToolRegistryV2 (新注册表)
// ============================================================================

export {
  ToolRegistryV2,
  globalToolRegistryV2
} from './registry/ToolRegistryV2.js'

// ============================================================================
// 适配器 (新旧接口转换)
// ============================================================================

export {
  adaptLegacyToV2,
  adaptV2ToLegacy,
  adaptLegacyToolsToV2,
  adaptV2ToolsToLegacy,
  isLegacyTool,
  isV2Tool
} from './adapters/ToolAdapter.js'

// ============================================================================
// 旧版接口 (保持向后兼容)
// ============================================================================

export {
  // 核心类型
  Tool,
  ToolDef,
  ToolContext,
  PermissionDecision,
  ToolProgress,
  ToolResult as LegacyToolResult,
  ToolMetadata,
  ToolCall as LegacyToolCall,
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

// ============================================================================
// 具体工具实现
// ============================================================================

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
import { ToolRegistryV2 } from './registry/ToolRegistryV2.js'
import { FileReadTool } from './file/FileReadTool.js'
import { FileWriteTool } from './file/FileWriteTool.js'
import { FileEditTool } from './file/FileEditTool.js'
import { GrepTool } from './search/GrepTool.js'
import { BashTool } from './shell/BashTool.js'
import { AgentTool } from './agent/AgentToolEnhanced.js'
import { FEATURE_FLAGS } from '../config/featureFlags.js'

/**
 * 注册所有标准工具到注册表（自动检测版本）
 */
export function registerStandardTools(
  registry?: ToolRegistry | ToolRegistryV2
): ToolRegistry | ToolRegistryV2 {
  // 如果没有提供注册表，根据功能开关创建
  if (!registry) {
    registry = FEATURE_FLAGS.USE_TOOL_V2 
      ? new ToolRegistryV2()
      : new ToolRegistry()
  }
  
  // 文件操作工具
  ;(registry as any).register(FileReadTool)
  ;(registry as any).register(FileWriteTool)
  ;(registry as any).register(FileEditTool)
  
  // 搜索工具
  ;(registry as any).register(GrepTool)
  
  // Shell 工具
  ;(registry as any).register(BashTool)
  
  // Agent 工具
  ;(registry as any).register(AgentTool)
  
  return registry
}

/**
 * 创建标准工具注册表（自动检测版本）
 */
export function createStandardToolRegistry(): ToolRegistry | ToolRegistryV2 {
  return registerStandardTools()
}

/**
 * 创建 ToolV2 标准工具注册表
 */
export function createStandardToolRegistryV2(): ToolRegistryV2 {
  const registry = new ToolRegistryV2()
  return registerStandardTools(registry) as ToolRegistryV2
}
