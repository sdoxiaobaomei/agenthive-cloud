/**
 * Agent Runtime - Main Entry Point
 * 
 * 统一导出所有模块，简化导入路径
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Tool Types
  Tool,
  ToolDef,
  ToolMetadata,
  ToolProgressData,
  ToolResult,
  ToolCategory,
  ToolClassifierResult,
  ToolCall,
  ToolExecutionResult,
  
  // Permission Types
  EnhancedPermissionDecision,
  PermissionBehavior,
  
  // Context Types
  FileStateCache,
  EnhancedToolContext,
} from './tools/ToolClaudeCode.js'

export type {
  // Agent Types
  AgentType,
  AgentDefinition,
  AgentConfig,
  AgentTask,
  AgentResult,
  AgentProgress,
  IsolationMode,
  Team,
} from './agent/AgentSystem.js'

export type {
  PermissionMode,
  PermissionRule,
  PermissionRequest,
  PermissionManagerConfig,
} from './permissions/PermissionManager.js'

// ============================================================================
// Core Classes
// ============================================================================

export {
  ToolRegistry,
  buildTool,
  globalToolRegistry,
  lazySchema,
  isLazySchema,
  resolveSchema,
  createFileStateCache,
} from './tools/ToolClaudeCode.js'

export {
  PermissionManager,
  initializePermissionManager,
  getPermissionManager,
  resetPermissionManager,
} from './permissions/PermissionManager.js'

import type { PermissionManager } from './permissions/PermissionManager.js'

export {
  AgentManager,
  initializeAgentManager,
  getAgentManager,
  createAgentTool,
  BUILTIN_AGENTS,
} from './agent/AgentSystem.js'

// ============================================================================
// Logger
// ============================================================================

export {
  Logger,
  createLogger,
  createChildLogger,
  globalLogger,
} from './utils/loggerEnhanced.js'

import { configureLogger } from './utils/loggerEnhanced.js'

export type {
  LogLevel,
  LogCategory,
  LogEntry,
  LoggerConfig,
} from './utils/loggerEnhanced.js'

// ============================================================================
// Tools
// ============================================================================

export { FileReadTool } from './tools/file/FileReadTool.js'
export { FileWriteTool } from './tools/file/FileWriteTool.js'
export { FileEditTool } from './tools/file/FileEditTool.js'
export { GlobTool } from './tools/file/GlobTool.js'
export { GrepTool } from './tools/search/GrepTool.js'
export { BashTool } from './tools/shell/BashTool.js'
export { GitTool } from './tools/git/GitTool.js'
export { WebSearchTool } from './tools/web/WebSearchTool.js'
export { WebFetchTool } from './tools/web/WebFetchTool.js'
export { HttpTool } from './tools/web/HttpTool.js'

// ============================================================================
// Tool Registration
// ============================================================================

import { ToolRegistry } from './tools/ToolClaudeCode.js'
import { FileReadTool } from './tools/file/FileReadTool.js'
import { FileWriteTool } from './tools/file/FileWriteTool.js'
import { FileEditTool } from './tools/file/FileEditTool.js'
import { GlobTool } from './tools/file/GlobTool.js'
import { GrepTool } from './tools/search/GrepTool.js'
import { BashTool } from './tools/shell/BashTool.js'
import { GitTool } from './tools/git/GitTool.js'
import { WebSearchTool } from './tools/web/WebSearchTool.js'
import { WebFetchTool } from './tools/web/WebFetchTool.js'
import { HttpTool } from './tools/web/HttpTool.js'

/**
 * Register all standard tools to a registry
 */
export function registerStandardTools(registry: ToolRegistry = new ToolRegistry()): ToolRegistry {
  // File operations
  registry.register(FileReadTool)
  registry.register(FileWriteTool)
  registry.register(FileEditTool)
  registry.register(GlobTool)
  
  // Search
  registry.register(GrepTool)
  
  // Shell
  registry.register(BashTool)
  
  // Git
  registry.register(GitTool)
  
  // Web
  registry.register(WebSearchTool)
  registry.register(WebFetchTool)
  registry.register(HttpTool)
  
  return registry
}

/**
 * Create a standard tool registry with all tools registered
 */
export function createStandardToolRegistry(): ToolRegistry {
  return registerStandardTools()
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '2.1.0'
export const AGENT_RUNTIME_VERSION = VERSION

// ============================================================================
// Initialization
// ============================================================================

import { Logger } from './utils/loggerEnhanced.js'

export interface AgentRuntimeConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
  permissionMode?: 'ask' | 'allow' | 'deny' | 'auto'
  workspacePath?: string
}

/**
 * Initialize the agent runtime
 */
export async function initialize(config: AgentRuntimeConfig = {}): Promise<{
  toolRegistry: ToolRegistry
  permissionManager: PermissionManager
  logger: Logger
}> {
  // Configure logger
  if (config.logLevel) {
    configureLogger({ minLevel: config.logLevel })
  }

  const logger = new Logger('AgentRuntime')
  logger.info(`Agent Runtime v${VERSION} initialized`, config)

  // Create and populate tool registry
  const toolRegistry = createStandardToolRegistry()
  logger.info(`Registered ${toolRegistry.list().length} tools`)

  // Initialize permission manager
  const { initializePermissionManager } = await import('./permissions/PermissionManager.js')
  const permissionManager = initializePermissionManager({
    mode: config.permissionMode || 'ask'
  })

  return { toolRegistry, permissionManager, logger }
}

// Auto-initialize on import if AGENT_AUTO_INIT is set
if (process.env.AGENT_AUTO_INIT === 'true') {
  initialize()
}
