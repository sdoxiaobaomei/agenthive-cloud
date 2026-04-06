/**
 * Enhanced Tools Index - 优化工具集合
 * 
 * 此模块提供参考 Claude Code 设计优化的工具实现：
 * - 工具元数据（并发安全、只读、破坏性标记）
 * - 自动分区执行（并发 vs 串行）
 * - 工具别名和搜索提示
 * - 更好的权限控制
 */

// ============================================================================
// 核心工具框架
// ============================================================================

export {
  // 增强版工具类型和构建器
  buildTool,
  ToolRegistry,
  ToolExecutor,
  ToolOrchestrator,
  createToolOrchestrator,
  
  // 类型
  type Tool,
  type ToolDef,
  type ToolContext,
  type ToolResult,
  type ToolProgress,
  type ToolMetadata,
  type PermissionDecision,
  type ToolCall,
  type ToolExecutionResult,
} from './ToolEnhanced.js'

export {
  type OrchestratorConfig,
  type ToolBatch,
  type ToolExecutionProgress,
  isReadOperation,
  isDestructiveOperation,
} from './ToolOrchestrator.js'

// ============================================================================
// 文件工具 - 并发安全读取，串行写入
// ============================================================================

export {
  FileReadTool,
  GlobTool,
  FileWriteTool,
  FileEditTool,
  type FileReadInput,
  type FileReadOutput,
} from './file/FileReadToolEnhanced.js'

// ============================================================================
// Shell 工具 - 动态判断并发安全性
// ============================================================================

export {
  BashTool,
  type BashInput,
  type BashOutput,
  // 导出命令分析函数供外部使用
} from './shell/BashToolEnhanced.js'

// ============================================================================
// 搜索工具 - 并发安全
// ============================================================================

export {
  GrepTool,
  type GrepInput,
  type GrepOutput,
} from './search/GrepToolEnhanced.js'

// ============================================================================
// Agent 工具
// ============================================================================

export {
  createAgentTool,
  registerBuiltInAgents,
  type AgentToolInput,
  type AgentToolOutput,
} from './agent/AgentToolEnhanced.js'

// ============================================================================
// 工具注册辅助函数
// ============================================================================

import { ToolRegistry } from './ToolEnhanced.js'
import { FileReadTool, GlobTool, FileWriteTool, FileEditTool } from './file/FileReadToolEnhanced.js'
import { BashTool } from './shell/BashToolEnhanced.js'
import { GrepTool } from './search/GrepToolEnhanced.js'

/**
 * 注册所有增强版工具到注册表
 */
export function registerEnhancedTools(registry: ToolRegistry): void {
  // 文件工具
  registry.register(FileReadTool)
  registry.register(GlobTool)
  registry.register(FileWriteTool)
  registry.register(FileEditTool)
  
  // Shell 工具
  registry.register(BashTool)
  
  // 搜索工具
  registry.register(GrepTool)
}

/**
 * 创建预配置的工具注册表
 */
export function createEnhancedToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry()
  registerEnhancedTools(registry)
  return registry
}

// ============================================================================
// 工具分类辅助函数
// ============================================================================

import type { Tool } from './ToolEnhanced.js'

/**
 * 按并发安全性分类工具
 */
export function categorizeToolsByConcurrency(tools: Tool[]): {
  concurrentSafe: Tool[]
  serialOnly: Tool[]
} {
  return {
    concurrentSafe: tools.filter(t => t.isConcurrencySafe()),
    serialOnly: tools.filter(t => !t.isConcurrencySafe())
  }
}

/**
 * 按操作类型分类工具
 */
export function categorizeToolsByOperation(tools: Tool[]): {
  readOnly: Tool[]
  write: Tool[]
  destructive: Tool[]
} {
  return {
    readOnly: tools.filter(t => t.isReadOnly()),
    write: tools.filter(t => !t.isReadOnly() && !t.isDestructive()),
    destructive: tools.filter(t => t.isDestructive())
  }
}

/**
 * 获取工具统计信息
 */
export function getToolStats(registry: ToolRegistry): {
  total: number
  enabled: number
  concurrentSafe: number
  readOnly: number
  destructive: number
  deferred: number
  aliases: number
} {
  const allTools = registry.getAllTools()
  
  return {
    total: allTools.length,
    enabled: allTools.filter(t => t.isEnabled()).length,
    concurrentSafe: allTools.filter(t => t.isConcurrencySafe()).length,
    readOnly: allTools.filter(t => t.isReadOnly()).length,
    destructive: allTools.filter(t => t.isDestructive()).length,
    deferred: allTools.filter(t => t.shouldDefer).length,
    aliases: allTools.reduce((sum, t) => sum + (t.aliases?.length || 0), 0)
  }
}
