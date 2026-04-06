/**
 * PermissionManager Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { 
  PermissionManager, 
  type PermissionManagerConfig 
} from '../../src/permissions/PermissionManager.js'

describe('PermissionManager', () => {
  let manager: PermissionManager

  beforeEach(() => {
    manager = new PermissionManager()
  })

  describe('mode: ask', () => {
    beforeEach(() => {
      manager = new PermissionManager({ mode: 'ask' })
    })

    it('should ask for non-readonly operations', async () => {
      const decision = await manager.checkPermission(
        'file_write',
        { path: '/test/file.txt' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: false,
          isReadOnly: false
        }
      )

      expect(decision.behavior).toBe('ask')
    })

    it('should allow readonly operations', async () => {
      const decision = await manager.checkPermission(
        'file_read',
        { path: '/test/file.txt' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: false,
          isReadOnly: true
        }
      )

      expect(decision.behavior).toBe('allow')
    })
  })

  describe('mode: allow', () => {
    beforeEach(() => {
      manager = new PermissionManager({ mode: 'allow' })
    })

    it('should allow non-destructive operations', async () => {
      const decision = await manager.checkPermission(
        'file_write',
        { path: '/test/file.txt' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: false,
          isReadOnly: false
        }
      )

      expect(decision.behavior).toBe('allow')
    })

    it('should still ask for destructive operations', async () => {
      const decision = await manager.checkPermission(
        'file_delete',
        { path: '/test/file.txt' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: true,
          isReadOnly: false
        }
      )

      expect(decision.behavior).toBe('ask')
    })
  })

  describe('mode: deny', () => {
    beforeEach(() => {
      manager = new PermissionManager({ mode: 'deny' })
    })

    it('should deny all operations', async () => {
      const decision = await manager.checkPermission(
        'file_read',
        { path: '/test/file.txt' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: false,
          isReadOnly: true
        }
      )

      expect(decision.behavior).toBe('deny')
    })
  })

  describe('rules', () => {
    it('should match tool name rule', async () => {
      manager.addRule({
        name: 'Allow file_read',
        toolName: 'file_read',
        behavior: 'allow',
        description: 'Always allow file reads'
      })

      const decision = await manager.checkPermission(
        'file_read',
        { path: '/test/file.txt' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: false,
          isReadOnly: true
        }
      )

      expect(decision.behavior).toBe('allow')
    })

    it('should match path pattern rule', async () => {
      manager.addRule({
        name: 'Block sensitive files',
        toolPattern: /file_read|file_write/,
        pathPattern: /\.env$/,
        behavior: 'deny',
        description: 'Block access to .env files'
      })

      const decision = await manager.checkPermission(
        'file_read',
        { path: '/workspace/.env' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: false,
          isReadOnly: true
        }
      )

      expect(decision.behavior).toBe('deny')
    })

    it('should match command pattern rule', async () => {
      manager.addRule({
        name: 'Block dangerous commands',
        toolName: 'bash',
        commandPattern: /rm\s+-rf/,
        behavior: 'deny',
        description: 'Block rm -rf commands'
      })

      const decision = await manager.checkPermission(
        'bash',
        { command: 'rm -rf /important' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: true,
          isReadOnly: false
        }
      )

      expect(decision.behavior).toBe('deny')
    })

    it('should remove rule', () => {
      const rule = manager.addRule({
        name: 'Test rule',
        toolName: 'test',
        behavior: 'allow'
      })

      expect(manager.getRules()).toHaveLength(1)

      const removed = manager.removeRule(rule.id)
      expect(removed).toBe(true)
      expect(manager.getRules()).toHaveLength(0)
    })
  })

  describe('caching', () => {
    beforeEach(() => {
      manager = new PermissionManager({ 
        mode: 'allow',
        cacheEnabled: true,
        cacheTTL: 1000 
      })
    })

    it('should cache decisions', async () => {
      const context = {
        agentId: 'test-agent',
        workspacePath: '/workspace',
        isDestructive: false,
        isReadOnly: true
      }

      // First check
      const decision1 = await manager.checkPermission(
        'file_read',
        { path: '/test/file.txt' },
        context
      )

      // Second check should use cache
      const decision2 = await manager.checkPermission(
        'file_read',
        { path: '/test/file.txt' },
        context
      )

      expect(decision1.behavior).toBe(decision2.behavior)
    })

    it('should not cache ask decisions', async () => {
      manager = new PermissionManager({ mode: 'ask' })

      const context = {
        agentId: 'test-agent',
        workspacePath: '/workspace',
        isDestructive: false,
        isReadOnly: false
      }

      // Multiple checks should not be cached
      const decision1 = await manager.checkPermission(
        'file_write',
        { path: '/test/file.txt' },
        context
      )

      const decision2 = await manager.checkPermission(
        'file_write',
        { path: '/test/file.txt' },
        context
      )

      // Both should ask (not cached)
      expect(decision1.behavior).toBe('ask')
      expect(decision2.behavior).toBe('ask')
    })
  })

  describe('history', () => {
    it('should record history', async () => {
      await manager.checkPermission(
        'file_read',
        { path: '/test/file.txt' },
        {
          agentId: 'test-agent',
          workspacePath: '/workspace',
          isDestructive: false,
          isReadOnly: true
        }
      )

      const history = manager.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0].toolName).toBe('file_read')
    })

    it('should limit history size', async () => {
      // Make many requests
      for (let i = 0; i < 1100; i++) {
        await manager.checkPermission(
          'file_read',
          { path: `/test/file${i}.txt` },
          {
            agentId: 'test-agent',
            workspacePath: '/workspace',
            isDestructive: false,
            isReadOnly: true
          }
        )
      }

      const history = manager.getHistory()
      expect(history.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('stats', () => {
    it('should return stats', () => {
      manager.addRule({
        name: 'Test rule',
        toolName: 'test',
        behavior: 'allow'
      })

      const stats = manager.getStats()
      expect(stats.rulesCount).toBe(1)
      expect(stats.cacheSize).toBe(0)
      expect(stats.pendingCount).toBe(0)
      expect(stats.mode).toBe('ask')
    })
  })

  describe('cleanup', () => {
    it('should cleanup expired rules', () => {
      const rule = manager.addRule({
        name: 'Temporary rule',
        toolName: 'temp',
        behavior: 'allow',
        expiresAt: Date.now() - 1000 // Already expired
      })

      expect(manager.getRules()).toHaveLength(1)

      manager.cleanup()

      expect(manager.getRules()).toHaveLength(0)
    })
  })
})
