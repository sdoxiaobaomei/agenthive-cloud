// MCP 系统入口
export * from './client.js'

import { MCPClientManager, globalMCPManager } from './client.js'

export function getMCPManager(): MCPClientManager {
  return globalMCPManager
}
