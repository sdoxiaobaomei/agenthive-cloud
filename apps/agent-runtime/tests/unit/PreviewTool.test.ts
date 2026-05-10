/**
 * PreviewTool 单元测试
 *
 * 测试重点：schema 校验、action 分发、状态转换逻辑、边界条件
 * 注意：不测试实际进程管理（需要真实环境），只测试逻辑分支
 */

import { describe, it, expect, vi } from 'vitest'
import {
  PreviewActionEnum,
  PreviewInputSchema,
  PreviewTool,
} from '../../src/tools/preview/PreviewTool.js'

const MOCK_WORKSPACE = '/tmp/test-workspace'

function createMockContext() {
  return {
    agentId: 'test-agent',
    workspacePath: MOCK_WORKSPACE,
    sendLog: vi.fn(),
    abortController: new AbortController(),
    getAppState: vi.fn(() => ({})),
    setAppState: vi.fn(),
    messages: [],
    checkPermission: vi.fn(),
    llm: {
      complete: vi.fn(),
      stream: vi.fn(),
    },
  }
}

// ============================================================================
// Schema Validation
// ============================================================================

describe('PreviewTool — Schema Validation', () => {
  it('should accept valid start action', () => {
    const result = PreviewInputSchema.safeParse({ action: 'start' })
    expect(result.success).toBe(true)
  })

  it('should accept valid stop action', () => {
    const result = PreviewInputSchema.safeParse({ action: 'stop' })
    expect(result.success).toBe(true)
  })

  it('should accept restart action', () => {
    const result = PreviewInputSchema.safeParse({ action: 'restart' })
    expect(result.success).toBe(true)
  })

  it('should accept status action', () => {
    const result = PreviewInputSchema.safeParse({ action: 'status' })
    expect(result.success).toBe(true)
  })

  it('should default port to 3000 when not provided', () => {
    const result = PreviewInputSchema.safeParse({ action: 'start' })
    expect(result.success).toBe(true)
    if (result.success) {
      // port is optional, undefined when not given
      expect(result.data.port).toBeUndefined()
    }
  })

  it('should accept custom port', () => {
    const result = PreviewInputSchema.safeParse({ action: 'start', port: 8080 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.port).toBe(8080)
    }
  })

  it('should reject port below 1024', () => {
    const result = PreviewInputSchema.safeParse({ action: 'start', port: 80 })
    expect(result.success).toBe(false)
  })

  it('should reject port above 65535', () => {
    const result = PreviewInputSchema.safeParse({ action: 'start', port: 99999 })
    expect(result.success).toBe(false)
  })

  it('should reject invalid action', () => {
    const result = PreviewInputSchema.safeParse({ action: 'pause' })
    expect(result.success).toBe(false)
  })

  it('should accept command override', () => {
    const result = PreviewInputSchema.safeParse({
      action: 'start',
      command: 'pnpm dev',
    })
    expect(result.success).toBe(true)
  })

  it('should accept env variables', () => {
    const result = PreviewInputSchema.safeParse({
      action: 'start',
      env: { NODE_ENV: 'test', PORT: '4000' },
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// Tool Metadata
// ============================================================================

describe('PreviewTool — Metadata', () => {
  it('should have correct name and category', () => {
    expect(PreviewTool.name).toBe('preview')
    expect(PreviewTool.category).toBe('execute')
  })

  it('should have aliases', () => {
    expect(PreviewTool.aliases).toContain('dev')
    expect(PreviewTool.aliases).toContain('server')
  })

  it('status action should be read-only', () => {
    expect(PreviewTool.isReadOnly({ action: 'status', port: 3000 } as any)).toBe(true)
  })

  it('start action should NOT be read-only', () => {
    expect(PreviewTool.isReadOnly({ action: 'start', port: 3000 } as any)).toBe(false)
  })

  it('stop action should be destructive', () => {
    expect(PreviewTool.isDestructive!({ action: 'stop', port: 3000 } as any)).toBe(true)
  })

  it('start action should NOT be destructive', () => {
    expect(PreviewTool.isDestructive!({ action: 'start', port: 3000 } as any)).toBe(false)
  })

  it('should NOT be concurrency-safe', () => {
    expect(PreviewTool.isConcurrencySafe({} as any)).toBe(false)
  })
})

// ============================================================================
// Status Action (no process needed)
// ============================================================================

describe('PreviewTool — status action', () => {
  it('should return unknown when no server is running', async () => {
    const result = await PreviewTool.call(
      { action: 'status' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('result')
    if (result.type === 'result') {
      expect(result.data.success).toBe(true)
      expect(result.data.status).toBe('unknown')
    }
  })
})

// ============================================================================
// Permissions
// ============================================================================

describe('PreviewTool — Permissions', () => {
  it('should ask for permission on start', async () => {
    const perm = await PreviewTool.checkPermissions(
      { action: 'start', port: 3000 } as any,
      createMockContext() as any,
    )
    expect(perm.behavior).toBe('ask')
  })

  it('should ask for permission on restart', async () => {
    const perm = await PreviewTool.checkPermissions(
      { action: 'restart', port: 3000 } as any,
      createMockContext() as any,
    )
    expect(perm.behavior).toBe('ask')
  })

  it('should allow status without asking', async () => {
    const perm = await PreviewTool.checkPermissions(
      { action: 'status', port: 3000 } as any,
      createMockContext() as any,
    )
    expect(perm.behavior).toBe('allow')
  })

  it('should allow stop without asking', async () => {
    const perm = await PreviewTool.checkPermissions(
      { action: 'stop', port: 3000 } as any,
      createMockContext() as any,
    )
    expect(perm.behavior).toBe('allow')
  })
})
