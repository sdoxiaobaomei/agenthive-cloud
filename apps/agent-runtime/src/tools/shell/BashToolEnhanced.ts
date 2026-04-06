/**
 * Enhanced Bash Tool - 优化的 Shell 命令执行工具
 * 
 * 参考 Claude Code 设计优化：
 * 1. 动态判断并发安全性（基于命令类型）
 * 2. 识别只读命令 vs 写入命令
 * 3. 危险命令检测和权限控制
 * 4. 超时控制
 * 5. 详细的执行信息
 */

import { z } from 'zod'
import { buildTool, PermissionDecision } from '../ToolEnhanced.js'
import { spawn } from 'child_process'
import { promisify } from 'util'
import { resolvePath } from '../../utils/path.js'

const execAsync = promisify(exec)
import { exec } from 'child_process'

// ============================================================================
// Schema 定义
// ============================================================================

const BashInput = z.object({
  command: z.string().describe('The shell command to execute'),
  timeout: z.number().optional().default(60000).describe('Timeout in milliseconds (default: 60000)'),
  cwd: z.string().optional().describe('Working directory for the command'),
}).describe('Execute a bash/shell command')

const BashOutput = z.object({
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  exitCode: z.number().describe('Exit code (0 = success)'),
  command: z.string().describe('The executed command'),
  duration: z.number().describe('Execution time in milliseconds'),
})

export type BashInput = z.infer<typeof BashInput>
export type BashOutput = z.infer<typeof BashOutput>

// ============================================================================
// 命令分类 - 用于判断并发安全性和权限
// ============================================================================

// 只读命令 - 并发安全
const READONLY_COMMANDS = [
  'cat', 'head', 'tail', 'less', 'more',
  'ls', 'll', 'find', 'which', 'whereis',
  'grep', 'egrep', 'fgrep', 'ripgrep', 'rg',
  'wc', 'sort', 'uniq', 'cut', 'awk', 'sed',
  'echo', 'printenv', 'env', 'pwd', 'whoami',
  'date', 'cal', 'df', 'du', 'ps', 'top',
  'git status', 'git log', 'git diff', 'git show',
  'git branch', 'git remote', 'git config --list',
  'npm list', 'npm view', 'npm search',
  'yarn list', 'pnpm list',
  'node --version', 'node -v', 'npm --version', 'npm -v'
]

// 危险命令 - 需要确认
const DANGEROUS_COMMANDS = [
  'rm -rf', 'rm -fr', 'rm -r -f', 'rm --recursive --force',
  'mkfs', 'dd if=', '>:', '>|',
  'chmod -R', 'chown -R',
  'curl.*|.*sh', 'wget.*|.*sh',
  'sudo', 'su -',
  'killall', 'pkill -9',
  'shutdown', 'reboot', 'halt',
  '>:/', '>/dev/sd', '>/dev/hd',
  'mv /', 'mv /* ',
]

// 写入命令 - 非并发安全
const WRITE_COMMANDS = [
  'rm', 'del', 'delete',
  'mv', 'move', 'rename',
  'cp', 'copy', 'scp',
  'mkdir', 'rmdir', 'touch',
  'chmod', 'chown', 'chgrp',
  'ln', 'link', 'symlink',
  'mount', 'umount',
  'tar', 'zip', 'unzip', 'gzip', 'gunzip',
  'git add', 'git commit', 'git push', 'git pull', 'git merge', 'git rebase',
  'git checkout', 'git reset', 'git clean', 'git stash',
  'npm install', 'npm uninstall', 'npm publish',
  'yarn add', 'yarn remove',
]

// ============================================================================
// 命令分析辅助函数
// ============================================================================

function analyzeCommand(command: string): {
  isReadOnly: boolean
  isWrite: boolean
  isDangerous: boolean
} {
  const lowerCmd = command.toLowerCase().trim()
  
  // 检查是否为只读命令
  const isReadOnly = READONLY_COMMANDS.some(cmd => 
    lowerCmd.startsWith(cmd.toLowerCase()) ||
    lowerCmd.includes(` ${cmd.toLowerCase()} `)
  )
  
  // 检查是否为写入命令
  const isWrite = WRITE_COMMANDS.some(cmd =>
    lowerCmd.startsWith(cmd.toLowerCase()) ||
    lowerCmd.includes(` ${cmd.toLowerCase()} `)
  )
  
  // 检查是否为危险命令
  const isDangerous = DANGEROUS_COMMANDS.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i')
    return regex.test(lowerCmd)
  })
  
  return { isReadOnly, isWrite, isDangerous }
}

// ============================================================================
// Bash 工具
// ============================================================================

export const BashTool = buildTool({
  name: 'bash',
  description: `Execute a bash/shell command.

Guidelines:
- Use for file operations, system commands, git operations, running scripts
- Read-only commands (ls, cat, grep, etc.) can run in parallel
- Write commands (rm, mv, git commit, etc.) run serially for safety
- Commands have a 60-second timeout by default
- Avoid interactive commands that require user input

Examples:
- List files: { "command": "ls -la" }
- Search code: { "command": "grep -r 'TODO' src/" }
- Git status: { "command": "git status" }
- Run tests: { "command": "npm test" }`,
  
  inputSchema: BashInput,
  outputSchema: BashOutput,
  
  aliases: ['shell', 'cmd', 'exec'],
  searchHint: 'run command shell bash execute',
  maxResultSizeChars: 50000,  // 50KB 输出限制
  
  // 动态判断并发安全性
  isConcurrencySafe: (input) => {
    const analysis = analyzeCommand(input.command)
    return analysis.isReadOnly && !analysis.isDangerous
  },
  
  // 动态判断是否为只读
  isReadOnly: (input) => {
    const analysis = analyzeCommand(input.command)
    return analysis.isReadOnly
  },
  
  // 动态判断是否为破坏性操作
  isDestructive: (input) => {
    const analysis = analyzeCommand(input.command)
    return analysis.isDangerous || 
           input.command.includes('rm -') || 
           input.command.includes('drop') ||
           input.command.includes('truncate')
  },
  
  // 用户友好名称
  userFacingName: (input) => {
    if (input?.command) {
      const cmd = input.command.slice(0, 40)
      return cmd.length < input.command.length ? `${cmd}...` : cmd
    }
    return 'bash'
  },
  
  // 自动分类器输入
  toAutoClassifierInput: (input) => input.command,
  
  // 权限检查
  checkPermissions: async (input, context): Promise<PermissionDecision> => {
    const analysis = analyzeCommand(input.command)
    
    // 检查危险命令
    if (analysis.isDangerous) {
      return {
        type: 'ask',
        prompt: `Execute potentially dangerous command: "${input.command}"?`
      }
    }
    
    // 检查写入命令
    if (analysis.isWrite) {
      return {
        type: 'ask',
        prompt: `Execute write command: "${input.command}"?`
      }
    }
    
    return { type: 'allow' }
  },
  
  // 核心执行
  execute: async (input, context): Promise<BashOutput> => {
    const startTime = Date.now()
    const cwd = input.cwd ? resolvePath(input.cwd, context.workspacePath) : context.workspacePath
    
    context.sendLog(`Running: ${input.command}`)
    
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', input.command], {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0' }
      })
      
      let stdout = ''
      let stderr = ''
      let killed = false
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        killed = true
        child.kill('SIGTERM')
        reject(new Error(`Command timed out after ${input.timeout}ms`))
      }, input.timeout)
      
      // 监听取消信号
      const onAbort = () => {
        if (!killed) {
          killed = true
          child.kill('SIGTERM')
          reject(new Error('Command cancelled'))
        }
      }
      
      if (context.signal) {
        context.signal.addEventListener('abort', onAbort)
      }
      
      child.stdout.on('data', (data) => {
        stdout += data.toString()
        // 限制输出大小
        if (stdout.length > 50000) {
          stdout = stdout.slice(0, 50000) + '\n... (output truncated)'
          child.stdout.destroy()
        }
      })
      
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      child.on('error', (error) => {
        clearTimeout(timeoutId)
        if (context.signal) {
          context.signal.removeEventListener('abort', onAbort)
        }
        reject(error)
      })
      
      child.on('close', (code) => {
        clearTimeout(timeoutId)
        if (context.signal) {
          context.signal.removeEventListener('abort', onAbort)
        }
        
        const duration = Date.now() - startTime
        
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          command: input.command,
          duration
        })
      })
    })
  },
  
  // 渲染方法
  renderToolUseMessage: (input) => `⚡ ${input.command.slice(0, 60)}${input.command.length > 60 ? '...' : ''}`,
  
  renderToolResultMessage: (result) => {
    if (result.exitCode === 0) {
      const lines = result.stdout.split('\n').length
      return `✓ Exit 0, ${result.duration}ms, ${lines} lines output`
    } else {
      return `✗ Exit ${result.exitCode}${result.stderr ? `, stderr: ${result.stderr.slice(0, 100)}` : ''}`
    }
  }
})
