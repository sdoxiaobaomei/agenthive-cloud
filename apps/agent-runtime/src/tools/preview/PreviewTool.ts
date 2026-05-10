/**
 * PreviewTool — 启动/停止/重启/检查 Nuxt 3 / Vite dev server 状态
 *
 * 对应 spec/002-agent-runtime.md §4.1
 */

import { z } from 'zod'
import { buildToolV2, createToolResult, createToolError, type ToolV2, type ToolResult, type ToolUseContext, type CanUseToolFn } from '../ToolV2.js'

// ── Schemas ───────────────────────────────────────────────────────────────

export const PreviewActionEnum = z.enum([
  'start',
  'stop',
  'restart',
  'status',
])

export const PreviewInputSchema = z.object({
  action: PreviewActionEnum.describe('Preview server action'),
  port: z.number().int().min(1024).max(65535).optional()
    .describe('Port for the dev server (default: 3000)'),
  command: z.string().optional()
    .describe('Custom command to start (default: "npm run dev")'),
  env: z.record(z.string()).optional()
    .describe('Additional environment variables'),
})

export const PreviewOutputSchema = z.object({
  success: z.boolean(),
  url: z.string().optional()
    .describe('URL of the running preview (e.g. http://localhost:3000)'),
  pid: z.number().optional()
    .describe('Process ID of the dev server'),
  status: z.enum(['running', 'stopped', 'error', 'unknown']).optional(),
  error: z.string().optional(),
})

export type PreviewInput = z.infer<typeof PreviewInputSchema>
export type PreviewOutput = z.infer<typeof PreviewOutputSchema>

// ── Process Registry ──────────────────────────────────────────────────────

// In production this would use Redis or a shared map
const runningPreviews = new Map<string, { pid: number; port: number; url: string }>()

// ── Tool Implementation ───────────────────────────────────────────────────

export const PreviewTool: ToolV2<PreviewInput, PreviewOutput> = buildToolV2<PreviewInput, PreviewOutput>({
  name: 'preview',
  description:
    'Start/stop/restart/check status of the Nuxt 3 / Vite dev server for previewing the frontend.',
  category: 'execute',
  aliases: ['dev', 'server'],

  inputSchema: PreviewInputSchema,
  outputSchema: PreviewOutputSchema,

  isReadOnly: (input) => input.action === 'status',
  isDestructive: (input) => input.action === 'stop',
  isConcurrencySafe: () => false,

  async call(input, context, _canUseTool) {
    const port = input.port ?? 3000
    try {
      const { spawn } = await import('child_process')

      const workspaceKey = context.workspacePath
      const existing = runningPreviews.get(workspaceKey)

      switch (input.action) {
        case 'start': {
          if (existing) {
            return createToolResult<PreviewOutput>({
              success: true,
              url: existing.url,
              pid: existing.pid,
              status: 'running',
            })
          }

          const cmd = input.command ?? 'npm run dev'
          const [bin, ...args] = cmd.split(' ')

          const child = spawn(bin, args, {
            cwd: context.workspacePath,
            env: { ...process.env, ...input.env },
            stdio: 'pipe',
            shell: true,
          })

          const url = `http://localhost:${port}`

          child.on('error', (err) => {
            context.sendLog(`Preview start error: ${err.message}`, true)
          })

          runningPreviews.set(workspaceKey, {
            pid: child.pid!,
            port,
            url,
          })

          context.sendLog(`Preview server starting on ${url}`)

          // Timeout to check if server is actually up
          await new Promise((resolve) => setTimeout(resolve, 3000))

          return createToolResult<PreviewOutput>({
            success: true,
            url,
            pid: child.pid!,
            status: 'running',
          })
        }

        case 'stop': {
          if (!existing) {
            return createToolResult<PreviewOutput>({
              success: true,
              status: 'stopped',
            })
          }

          try {
            process.kill(existing.pid, 'SIGTERM')
          } catch {
            // Already dead — fine
          }

          runningPreviews.delete(workspaceKey)
          context.sendLog(`Preview server stopped (PID ${existing.pid})`)

          return createToolResult<PreviewOutput>({
            success: true,
            status: 'stopped',
          })
        }

        case 'restart': {
          // Composite: stop + start
          if (existing) {
            try { process.kill(existing.pid, 'SIGTERM') } catch { /* already dead */ }
            runningPreviews.delete(workspaceKey)
          }

          const cmd = input.command ?? 'npm run dev'
          const [bin, ...args] = cmd.split(' ')
          const child = spawn(bin, args, {
            cwd: context.workspacePath,
            env: { ...process.env, ...input.env },
            stdio: 'pipe',
            shell: true,
          })

          const url = `http://localhost:${port}`
          runningPreviews.set(workspaceKey, { pid: child.pid!, port, url })

          await new Promise((resolve) => setTimeout(resolve, 3000))

          return createToolResult<PreviewOutput>({
            success: true,
            url,
            pid: child.pid!,
            status: 'running',
          })
        }

        case 'status': {
          if (existing) {
            // Check if the process is still alive
            try {
              process.kill(existing.pid, 0) // Signal 0 = check existence
              return createToolResult<PreviewOutput>({
                success: true,
                url: existing.url,
                pid: existing.pid,
                status: 'running',
              })
            } catch {
              runningPreviews.delete(workspaceKey)
              return createToolResult<PreviewOutput>({
                success: true,
                status: 'stopped',
              })
            }
          }

          return createToolResult<PreviewOutput>({
            success: true,
            status: 'unknown',
          })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return createToolError(`PreviewTool error: ${msg}`) as unknown as ToolResult<PreviewOutput>
    }
  },

  checkPermissions: async (input, _context) => {
    if (input.action === 'start' || input.action === 'restart') {
      return { behavior: 'ask', prompt: `Start dev server on port ${input.port}?` }
    }
    return { behavior: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Preview: ${input.action} server on port ${input.port ?? 3000}`
  },

  toAutoClassifierInput(input) {
    return `preview ${input.action}`
  },

  userFacingName() { return 'Preview Server' },
})

export default PreviewTool
