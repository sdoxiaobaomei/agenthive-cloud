/**
 * Agent Runtime - 基础使用示例
 */

import { 
  initialize, 
  FileReadTool, 
  BashTool,
  getPermissionManager,
  Logger
} from '../src/index.js'

async function main() {
  // 1. 初始化运行时
  console.log('=== Initializing Agent Runtime ===')
  const { toolRegistry, permissionManager, logger } = await initialize({
    logLevel: 'info',
    permissionMode: 'ask'
  })

  console.log(`Registered ${toolRegistry.list().length} tools`)
  console.log(`Permission mode: ${permissionManager.getMode()}`)

  // 2. 配置权限规则
  console.log('\n=== Configuring Permissions ===')
  permissionManager.addRule({
    name: 'Allow file reads',
    toolName: 'file_read',
    behavior: 'allow'
  })

  permissionManager.addRule({
    name: 'Allow safe bash commands',
    toolName: 'bash',
    commandPattern: /^(ls|pwd|echo|cat|grep|find|git\s+(status|log|diff))/,
    behavior: 'allow'
  })

  console.log(`Added ${permissionManager.getRules().length} permission rules`)

  // 3. 创建工具上下文
  const context = {
    agentId: 'example-agent',
    workspacePath: process.cwd(),
    sendLog: (message: string, isError = false) => {
      const prefix = isError ? '[ERROR]' : '[LOG]'
      console.log(`${prefix} ${message}`)
    }
  }

  // 4. 使用 FileReadTool
  console.log('\n=== Using FileReadTool ===')
  try {
    const packageJson = await FileReadTool.execute(
      { path: 'package.json' },
      context
    )
    console.log('package.json content preview:')
    console.log(packageJson.content.slice(0, 200) + '...')
  } catch (error) {
    console.error('Failed to read package.json:', error)
  }

  // 5. 使用 BashTool
  console.log('\n=== Using BashTool ===')
  try {
    const result = await BashTool.execute(
      { command: 'ls -la', description: 'List files' },
      context
    )
    console.log('Command output preview:')
    console.log(result.stdout.slice(0, 200) + '...')
  } catch (error) {
    console.error('Failed to run command:', error)
  }

  // 6. 检查权限
  console.log('\n=== Checking Permissions ===')
  const readDecision = await permissionManager.checkPermission(
    'file_read',
    { path: '/test/file.txt' },
    { agentId: 'test', workspacePath: '/workspace', isDestructive: false, isReadOnly: true }
  )
  console.log('File read permission:', readDecision.behavior)

  const writeDecision = await permissionManager.checkPermission(
    'file_write',
    { path: '/test/file.txt' },
    { agentId: 'test', workspacePath: '/workspace', isDestructive: false, isReadOnly: false }
  )
  console.log('File write permission:', writeDecision.behavior)

  // 7. 查看统计
  console.log('\n=== Permission Statistics ===')
  console.log(permissionManager.getStats())

  // 8. 查看历史
  console.log('\n=== Permission History ===')
  console.log(`Total requests: ${permissionManager.getHistory().length}`)

  console.log('\n=== Example Complete ===')
}

main().catch(console.error)
