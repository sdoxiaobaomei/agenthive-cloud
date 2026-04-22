// Shell 命令执行工具 - 使用 ToolEnhanced 优化版
import { z } from 'zod'
import { buildTool, type EnhancedToolContext as ToolContext, type EnhancedPermissionDecision as PermissionDecision } from '../ToolClaudeCode.js'
import { spawn } from 'child_process'
import { resolve, isAbsolute } from 'path'

const inputSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  cwd: z.string().optional().describe('Working directory for the command'),
  env: z.record(z.string()).optional().describe('Additional environment variables'),
  timeout: z.number().optional().default(60000).describe('Timeout in milliseconds (default: 60s)'),
  description: z.string().optional().describe('Description of what this command does')
})

const outputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  success: z.boolean()
})

// 危险命令模式
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,           // rm -rf /
  />\s*\/dev\/null/,          // 重定向到 /dev/null 可能隐藏危险操作
  /mkfs\./,                   // 格式化文件系统
  /dd\s+if=/,                 // dd 命令
  /:\(\){ :|:& };:/,            // Fork bomb
]

// 读取命令模式（用于 isReadOnly 判断）
const READONLY_PATTERNS = [
  /^\s*(cat|ls|find|grep|echo|head|tail|wc|sort|uniq|awk|sed|ps|top|df|du|file|which|whereis|stat|id|whoami|pwd|date|env|printenv|history)\s/,
  /^\s*git\s+(status|log|show|diff|branch|remote|config\s+--get)/,
  /^\s*(npm|yarn|pnpm)\s+list/,
  /^\s*(node|python|python3)\s+--version/,
  /^\s*docker\s+(ps|images|info|version)/,
]

// 破坏性命令模式
const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf?\s/,
  />\s+[^>]/,  // 覆盖重定向
  /mkfs\./,
  /dd\s+if=.*of=/,
  /\bdocker\s+(rm|rmi|kill|stop)\s/,
]

export const BashTool = buildTool({
  name: 'bash',
  description: `Execute a shell command in the workspace.
Supports standard shell syntax including pipes, redirects, and environment variables.
Returns stdout, stderr, and exit code.`,
  searchHint: 'execute shell command bash',
  inputSchema,
  outputSchema,
  
  // 安全标记 - Shell 命令需要动态判断
  isConcurrencySafe: (input) => {
    // 如果命令包含写入操作，不可并发
    if (input.command.match(/[>|;]\s*\w+\s/)) return false
    return isReadOnlyCommand(input.command)
  },
  isReadOnly: (input) => isReadOnlyCommand(input.command),
  isDestructive: (input) => {
    return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(input.command))
  },
  
  async execute(input, context: ToolContext) {
    const cwd = input.cwd 
      ? resolveFullPath(input.cwd, context.workspacePath)
      : context.workspacePath

    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...input.env }
      
      context.sendLog(`$ ${input.command}`)
      
      const child = spawn(input.command, [], {
        cwd,
        shell: true,
        env,
        timeout: input.timeout
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString()
        stdout += chunk
        context.sendLog(chunk)
      })

      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString()
        stderr += chunk
        context.sendLog(chunk, true)
      })

      child.on('close', (code: number | null) => {
        const exitCode = code ?? 1
        resolve({
          stdout,
          stderr,
          exitCode,
          success: exitCode === 0
        })
      })

      child.on('error', (error: Error) => {
        reject(error)
      })

      // 处理中止信号
      if (context.signal) {
        context.signal.addEventListener('abort', () => {
          child.kill('SIGTERM')
          reject(new Error('Command was cancelled'))
        })
      }
    })
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    const cwd = input.cwd 
      ? resolveFullPath(input.cwd, context.workspacePath)
      : context.workspacePath
    
    // 检查工作目录
    if (!isPathWithinWorkspace(cwd, context.workspacePath)) {
      return {
        behavior: 'deny',
        message: `Access denied: cwd is outside workspace`
      }
    }

    // 检查危险命令
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(input.command)) {
        return {
          behavior: 'deny',
          message: `Dangerous command detected: ${input.command}`
        }
      }
    }

    // 检查写入敏感目录的命令
    const sensitiveDirs = ['/etc', '/usr', '/bin', '/sbin', '/lib', '/sys', '/proc']
    for (const dir of sensitiveDirs) {
      if (input.command.includes(dir) && !context.workspacePath.includes(dir)) {
        return {
          behavior: 'ask',
          prompt: `Command may access system directory: ${dir}. Allow?`
        }
      }
    }

    return { behavior: 'allow' }
  },

  renderToolUseMessage(input) {
    return input.description || `Running: ${input.command!.slice(0, 50)}${input.command!.length > 50 ? '...' : ''}`
  },

  renderToolResultMessage(result) {
    if (result.success) {
      return `Command completed with exit code 0`
    }
    return `Command failed with exit code ${result.exitCode}`
  },

  userFacingName(input) {
    return input?.description || `Run ${input?.command?.slice(0, 30) || 'command'}...`
  },

  toAutoClassifierInput(input) {
    return `Execute command: ${input.command}`
  },

  classify(input) {
    const isReadOnly = isReadOnlyCommand(input.command)
    const isDestructive = DESTRUCTIVE_PATTERNS.some(p => p.test(input.command))
    
    return {
      category: 'execute',
      isSafe: isReadOnly,
      riskLevel: isDestructive ? 'high' : (isReadOnly ? 'low' : 'medium'),
      suggestedConfirmation: !isReadOnly
    }
  }
})

// 辅助函数
function resolveFullPath(inputPath: string, workspacePath: string): string {
  if (isAbsolute(inputPath)) {
    return inputPath
  }
  return resolve(workspacePath, inputPath)
}

function isPathWithinWorkspace(fullPath: string, workspacePath: string): boolean {
  const resolvedWorkspace = resolve(workspacePath)
  const resolvedPath = resolve(fullPath)
  return resolvedPath.startsWith(resolvedWorkspace)
}

// 判断是否为只读命令
function isReadOnlyCommand(command: string): boolean {
  return READONLY_PATTERNS.some(pattern => pattern.test(command))
}
