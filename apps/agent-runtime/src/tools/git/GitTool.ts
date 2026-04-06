/**
 * Git Tool - Git 操作工具
 */
import { z } from 'zod'
import { buildTool, type ToolContext, type PermissionDecision } from '../ToolClaudeCode.js'
import simpleGit, { SimpleGit } from 'simple-git'
import { resolve } from 'path'

const inputSchema = z.object({
  command: z.enum([
    'status',
    'log',
    'diff',
    'branch',
    'show',
    'blame'
  ]).describe('Git command to execute'),
  args: z.record(z.any()).optional().describe('Command-specific arguments')
})

const outputSchema = z.object({
  success: z.boolean(),
  data: z.any().describe('Command output'),
  error: z.string().optional()
})

// Read-only git commands
const READONLY_COMMANDS = ['status', 'log', 'diff', 'branch', 'show', 'blame']

export const GitTool = buildTool({
  name: 'git',
  description: `Execute read-only git commands to inspect repository state.

Available commands:
- status: Get working directory status
- log: View commit history
- diff: Show changes between commits, working tree, etc.
- branch: List branches
- show: Show various types of objects (commits, trees, etc.)
- blame: Show what revision and author last modified each line`,
  searchHint: 'git repository version control',
  category: 'read',
  
  inputSchema,
  outputSchema,
  
  isConcurrencySafe: () => true,
  isReadOnly: (input) => READONLY_COMMANDS.includes(input.command),
  isDestructive: () => false,
  
  async execute(input, context: ToolContext) {
    const git: SimpleGit = simpleGit(context.workspacePath)
    
    try {
      let data: any

      switch (input.command) {
        case 'status':
          data = await git.status()
          break

        case 'log': {
          const logArgs = input.args || {}
          const log = await git.log({
            maxCount: logArgs.maxCount || 20,
            from: logArgs.from,
            to: logArgs.to,
            file: logArgs.file
          })
          data = log
          break
        }

        case 'diff': {
          const diffArgs = input.args || {}
          if (diffArgs.cached) {
            data = await git.diff(['--cached'])
          } else if (diffArgs.commit) {
            data = await git.show([diffArgs.commit, '--stat'])
          } else {
            data = await git.diff()
          }
          break
        }

        case 'branch': {
          const branches = await git.branch(['-a'])
          data = {
            current: branches.current,
            all: branches.all,
            branches: branches.branches
          }
          break
        }

        case 'show': {
          const showArgs = input.args || {}
          const object = showArgs.object || 'HEAD'
          data = await git.show([object, '--stat'])
          break
        }

        case 'blame': {
          const blameArgs = input.args || {}
          if (!blameArgs.file) {
            throw new Error('File path required for blame command')
          }
          data = await git.raw(['blame', blameArgs.file])
          break
        }

        default:
          throw new Error(`Unknown git command: ${input.command}`)
      }

      return {
        success: true,
        data
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown git error'
      return {
        success: false,
        data: null,
        error: message
      }
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    // Only allow read-only commands
    if (!READONLY_COMMANDS.includes(input.command)) {
      return {
        type: 'deny',
        message: `Git command '${input.command}' is not allowed. Only read-only commands are permitted.`
      }
    }

    return { type: 'allow' }
  },

  renderToolUseMessage(input) {
    const argStr = input.args ? ` ${JSON.stringify(input.args)}` : ''
    return `Git ${input.command}${argStr}`
  },

  renderToolResultMessage(result) {
    if (!result.success) {
      return `Git command failed: ${result.error}`
    }
    return `Git command completed successfully`
  },

  userFacingName(input) {
    return `Git ${input?.command || 'command'}`
  },

  toAutoClassifierInput(input) {
    return `Git ${input.command}`
  },

  classify(input) {
    return {
      category: 'read',
      isSafe: true,
      riskLevel: 'low',
      suggestedConfirmation: false
    }
  }
})
