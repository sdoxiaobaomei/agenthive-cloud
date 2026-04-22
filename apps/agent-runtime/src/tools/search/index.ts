// 搜索工具集合
export { GrepTool } from './GrepTool.js'

import { GrepTool } from './GrepTool.js'
import type { ToolRegistry } from '../Tool.js'

// 注册所有搜索工具
export function registerSearchTools(registry: ToolRegistry): void {
  ;(registry as any).register(GrepTool)
}
