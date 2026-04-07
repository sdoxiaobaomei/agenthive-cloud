/**
 * Tool 适配器模块
 * 
 * 提供新旧 Tool 接口的双向转换
 */

export {
  adaptLegacyToV2,
  adaptV2ToLegacy,
  adaptLegacyToolsToV2,
  adaptV2ToolsToLegacy,
  isLegacyTool,
  isV2Tool
} from './ToolAdapter.js'

export type { LegacyTool, LegacyToolContext } from './ToolAdapter.js'
