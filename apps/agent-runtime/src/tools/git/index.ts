// Git 工具集合
export { GitTool } from './GitTool.js'

import { GitTool } from './GitTool.js'
import type { ToolRegistry } from '../Tool.js'

// 注册所有 Git 工具
export function registerGitTools(registry: ToolRegistry): void {
  ;(registry as any).register(GitTool)
}
