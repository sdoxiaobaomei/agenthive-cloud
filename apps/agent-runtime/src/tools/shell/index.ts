// Shell 工具集合
export { BashTool } from './BashTool.js'

import { BashTool } from './BashTool.js'
import type { ToolRegistry } from '../Tool.js'

// 注册所有 Shell 工具
export function registerShellTools(registry: ToolRegistry): void {
  registry.register(BashTool)
}
