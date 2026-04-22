// Web 工具集合
export { WebSearchTool } from './WebSearchTool.js'
export { WebFetchTool } from './WebFetchTool.js'
export { HttpTool } from './HttpTool.js'

import { WebSearchTool } from './WebSearchTool.js'
import { WebFetchTool } from './WebFetchTool.js'
import { HttpTool } from './HttpTool.js'
import type { ToolRegistry } from '../Tool.js'

// 注册所有 Web 工具
export function registerWebTools(registry: ToolRegistry): void {
  ;(registry as any).register(WebSearchTool)
  ;(registry as any).register(WebFetchTool)
  ;(registry as any).register(HttpTool)
}
