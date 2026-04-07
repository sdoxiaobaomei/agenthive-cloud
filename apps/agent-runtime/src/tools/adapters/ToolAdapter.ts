/**
 * Tool 适配器层
 * 
 * 实现新旧 Tool 接口的双向转换，确保向后兼容
 */

import type { Tool as LegacyTool, ToolContext as LegacyToolContext } from '../ToolClaudeCode.js'
import type {
  ToolV2,
  ToolUseContext,
  ToolResult,
  PermissionResult,
  Message,
  AssistantMessage,
  LLMResult,
  LLMStreamChunk
} from '../ToolV2.js'
import { Logger } from '../../utils/loggerEnhanced.js'

const logger = new Logger('ToolAdapter')

// ============================================================================
// 旧 Tool 转新 ToolV2
// ============================================================================

export function adaptLegacyToV2(legacyTool: LegacyTool): ToolV2 {
  logger.debug(`Adapting legacy tool to V2: ${legacyTool.name}`)
  
  return {
    // 基础属性
    name: legacyTool.name,
    description: legacyTool.description,
    aliases: legacyTool.aliases,
    searchHint: legacyTool.searchHint,
    category: legacyTool.category,
    
    // Schema
    inputSchema: legacyTool.inputSchema,
    outputSchema: legacyTool.outputSchema,
    
    // MCP 相关
    isMcp: (legacyTool as any).isMcp ?? false,
    mcpInfo: (legacyTool as any).mcpInfo,
    shouldDefer: legacyTool.shouldDefer,
    alwaysLoad: legacyTool.alwaysLoad,
    
    // 核心方法 - 适配到 call()
    call: async (input, context, canUseTool, assistantMessage, onProgress) => {
      try {
        // 1. 执行权限检查
        const permission = await canUseTool(legacyTool.name, input)
        
        if (permission.behavior === 'deny') {
          return {
            data: null,
            error: permission.message || `Permission denied for tool: ${legacyTool.name}`,
            type: 'error'
          }
        }
        
        if (permission.behavior === 'ask') {
          // 在适配器层，我们默认允许（实际应该在更高层处理 ask）
          logger.debug(`Tool ${legacyTool.name} requires ask permission, allowing in adapter`)
        }
        
        // 2. 转换上下文
        const legacyContext = adaptContextToLegacy(context)
        
        // 3. 调用旧版 execute
        const output = await legacyTool.execute(input, legacyContext)
        
        // 4. 包装结果
        return {
          data: output,
          type: 'result',
          resultForAssistant: formatOutputForAssistant(output)
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`Tool execution failed: ${legacyTool.name}`, { error: errorMessage })
        
        return {
          data: null,
          error: errorMessage,
          type: 'error'
        }
      }
    },
    
    // 权限方法适配
    checkPermissions: async (input, context) => {
      if (legacyTool.checkPermissions) {
        const legacyResult = await legacyTool.checkPermissions(input, context as any)
        return adaptPermissionResult(legacyResult)
      }
      return { behavior: 'allow' }
    },
    
    isReadOnly: (input) => {
      return legacyTool.isReadOnly?.(input) ?? false
    },
    
    isDestructive: (input) => {
      return legacyTool.isDestructive?.(input) ?? false
    },
    
    isConcurrencySafe: (input) => {
      return legacyTool.isConcurrencySafe?.(input) ?? false
    },
    
    // 渲染方法适配
    renderToolUseMessage: (input) => {
      if (legacyTool.renderToolUseMessage) {
        return legacyTool.renderToolUseMessage(input)
      }
      return `Using ${legacyTool.name}`
    },
    
    renderToolResultMessage: (output) => {
      if (legacyTool.renderToolResultMessage) {
        return legacyTool.renderToolResultMessage(output)
      }
      return `Completed ${legacyTool.name}`
    },
    
    // 分类器适配
    toAutoClassifierInput: (input) => {
      if (legacyTool.toAutoClassifierInput) {
        return legacyTool.toAutoClassifierInput(input)
      }
      return `${legacyTool.name}: ${JSON.stringify(input).slice(0, 200)}`
    },
    
    userFacingName: (input) => {
      if (legacyTool.userFacingName) {
        return legacyTool.userFacingName(input)
      }
      return legacyTool.name
    }
  }
}

// ============================================================================
// 新 ToolV2 转旧 Tool
// ============================================================================

export function adaptV2ToLegacy(modernTool: ToolV2): LegacyTool {
  logger.debug(`Adapting V2 tool to legacy: ${modernTool.name}`)
  
  return {
    // 基础属性
    name: modernTool.name,
    description: modernTool.description,
    aliases: modernTool.aliases,
    searchHint: modernTool.searchHint,
    category: modernTool.category,
    
    // Schema
    inputSchema: modernTool.inputSchema,
    outputSchema: modernTool.outputSchema,
    
    // 延迟加载控制
    shouldDefer: modernTool.shouldDefer,
    alwaysLoad: modernTool.alwaysLoad,
    
    // 核心方法 - 适配到 execute()
    execute: async (input, legacyContext) => {
      // 1. 创建 AbortController
      const abortController = new AbortController()
      
      // 2. 转换上下文
      const toolUseContext = adaptContextToV2(legacyContext, abortController)
      
      // 3. 创建模拟的 canUseTool
      const canUseTool = async (): Promise<PermissionResult> => {
        return { behavior: 'allow' }
      }
      
      // 4. 调用新版 call
      const result = await modernTool.call(
        input,
        toolUseContext,
        canUseTool,
        null,
        undefined
      )
      
      // 5. 处理结果
      if (result.error) {
        throw new Error(result.error)
      }
      
      return result.data
    },
    
    // 权限方法
    checkPermissions: async (input, context) => {
      const result = await modernTool.checkPermissions(input, context as ToolUseContext)
      return adaptPermissionResultToLegacy(result)
    },
    
    isReadOnly: (input) => {
      return modernTool.isReadOnly(input)
    },
    
    isDestructive: (input) => {
      return modernTool.isDestructive?.(input) ?? false
    },
    
    isConcurrencySafe: (input) => {
      return modernTool.isConcurrencySafe(input)
    },
    
    // 渲染方法
    renderToolUseMessage: (input) => {
      return modernTool.renderToolUseMessage?.(input) ?? `Using ${modernTool.name}`
    },
    
    renderToolResultMessage: (output) => {
      return modernTool.renderToolResultMessage?.(output) ?? `Completed ${modernTool.name}`
    },
    
    // 分类器方法
    toAutoClassifierInput: (input) => {
      return modernTool.toAutoClassifierInput(input)
    },
    
    userFacingName: (input) => {
      return modernTool.userFacingName(input)
    },
    
    // 额外属性
    isEnabled: () => true,
    classify: (input) => {
      return {
        category: modernTool.category ?? 'execute',
        isSafe: !modernTool.isDestructive?.(input),
        riskLevel: modernTool.isDestructive?.(input) ? 'high' : 'low',
        suggestedConfirmation: !!modernTool.isDestructive?.(input)
      }
    }
  } as LegacyTool
}

// ============================================================================
// 上下文适配
// ============================================================================

function adaptContextToLegacy(context: ToolUseContext): LegacyToolContext {
  return {
    agentId: context.agentId,
    workspacePath: context.workspacePath,
    sendLog: context.sendLog,
    signal: context.abortController.signal,
    checkPermission: context.checkPermission,
    llm: context.llm,
    fileState: undefined,
    queryTracking: context.queryTracking,
    parentContext: context.parentContext
  }
}

function adaptContextToV2(
  legacyContext: LegacyToolContext,
  abortController: AbortController
): ToolUseContext {
  return {
    agentId: legacyContext.agentId,
    workspacePath: legacyContext.workspacePath,
    sendLog: legacyContext.sendLog || (() => {}),
    abortController,
    getAppState: () => ({}),
    setAppState: () => {},
    messages: [],
    checkPermission: legacyContext.checkPermission || (async () => ({ behavior: 'allow' as const })),
    llm: legacyContext.llm || {
      complete: async (): Promise<LLMResult> => ({ content: '' }),
      stream: async function* (): AsyncGenerator<LLMStreamChunk> {}
    }
  }
}

// ============================================================================
// 权限结果适配
// ============================================================================

function adaptPermissionResult(legacyResult: any): PermissionResult {
  const behavior = legacyResult.behavior || legacyResult.type || 'allow'
  
  return {
    behavior: behavior as PermissionResult['behavior'],
    message: legacyResult.message,
    prompt: legacyResult.prompt,
    updatedInput: legacyResult.updatedInput
  }
}

function adaptPermissionResultToLegacy(result: PermissionResult): any {
  return {
    behavior: result.behavior,
    type: result.behavior,
    message: result.message,
    prompt: result.prompt,
    updatedInput: result.updatedInput
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function formatOutputForAssistant(output: any): string {
  if (typeof output === 'string') {
    return output
  }
  
  if (output === null || output === undefined) {
    return ''
  }
  
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

// ============================================================================
// 批量适配
// ============================================================================

export function adaptLegacyToolsToV2(legacyTools: LegacyTool[]): ToolV2[] {
  return legacyTools.map(adaptLegacyToV2)
}

export function adaptV2ToolsToLegacy(modernTools: ToolV2[]): LegacyTool[] {
  return modernTools.map(adaptV2ToLegacy)
}

// ============================================================================
// 类型检测
// ============================================================================

export function isLegacyTool(tool: any): tool is LegacyTool {
  return !!tool && 
    typeof tool.name === 'string' &&
    typeof tool.execute === 'function' &&
    !tool.call // V2 使用 call 而不是 execute
}

export function isV2Tool(tool: any): tool is ToolV2 {
  return !!tool &&
    typeof tool.name === 'string' &&
    typeof tool.call === 'function'
}
