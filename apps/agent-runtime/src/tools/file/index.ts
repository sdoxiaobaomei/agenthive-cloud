// 文件工具集合
export { FileReadTool } from './FileReadTool.js'
export { FileWriteTool } from './FileWriteTool.js'
export { FileEditTool } from './FileEditTool.js'
export { GlobTool } from './GlobTool.js'

import { FileReadTool } from './FileReadTool.js'
import { FileWriteTool } from './FileWriteTool.js'
import { FileEditTool } from './FileEditTool.js'
import { GlobTool } from './GlobTool.js'
import type { ToolRegistry } from '../Tool.js'

// 注册所有文件工具
export function registerFileTools(registry: ToolRegistry): void {
  ;(registry as any).register(FileReadTool)
  ;(registry as any).register(FileWriteTool)
  ;(registry as any).register(FileEditTool)
  ;(registry as any).register(GlobTool)
}
