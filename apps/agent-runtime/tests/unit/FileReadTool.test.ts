/**
 * FileReadTool Unit Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FileReadTool } from '../../src/tools/file/FileReadTool.js'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

describe('FileReadTool', () => {
  const testDir = join(tmpdir(), 'agent-runtime-test-' + Date.now())
  
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true })
    await writeFile(join(testDir, 'test.txt'), 'Line 1\nLine 2\nLine 3\n')
    await writeFile(join(testDir, 'large.txt'), Array(100).fill('Test line').join('\n'))
  })

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('execute', () => {
    it('should read a file', async () => {
      const result = await FileReadTool.execute(
        { path: join(testDir, 'test.txt') },
        {
          agentId: 'test',
          workspacePath: testDir,
          sendLog: () => {}
        }
      )

      expect(result.content.trim()).toBe('Line 1\nLine 2\nLine 3')
      expect(result.lines).toBe(4)
      expect(typeof result.truncated).toBe('boolean')
    })

    it('should read with offset and limit', async () => {
      const result = await FileReadTool.execute(
        { path: join(testDir, 'test.txt'), offset: 2, limit: 1 },
        {
          agentId: 'test',
          workspacePath: testDir,
          sendLog: () => {}
        }
      )

      expect(result.content).toBe('Line 2')
      expect(result.lines).toBe(4)
      expect(typeof result.truncated).toBe('boolean')
    })

    it('should truncate large files', async () => {
      const result = await FileReadTool.execute(
        { path: join(testDir, 'large.txt'), limit: 10 },
        {
          agentId: 'test',
          workspacePath: testDir,
          sendLog: () => {}
        }
      )

      expect(result.truncated).toBe(true)
      expect(result.content.split('\n')).toHaveLength(10)
    })

    it('should throw for non-existent file', async () => {
      await expect(
        FileReadTool.execute(
          { path: join(testDir, 'nonexistent.txt') },
          {
            agentId: 'test',
            workspacePath: testDir,
            sendLog: () => {}
          }
        )
      ).rejects.toThrow('File not found')
    })
  })

  describe('checkPermissions', () => {
    it('should allow file within workspace', async () => {
      const decision = await FileReadTool.checkPermissions(
        { path: join(testDir, 'test.txt') },
        {
          agentId: 'test',
          workspacePath: testDir,
          sendLog: () => {}
        }
      )

      expect(decision.behavior || decision.type).toBe('allow')
    })

    it('should deny file outside workspace', async () => {
      const decision = await FileReadTool.checkPermissions(
        { path: '/etc/passwd' },
        {
          agentId: 'test',
          workspacePath: testDir,
          sendLog: () => {}
        }
      )

      expect(decision.behavior || decision.type).toBe('deny')
    })
  })

  describe('metadata', () => {
    it('should be read-only', () => {
      expect(FileReadTool.isReadOnly({})).toBe(true)
    })

    it('should be concurrency safe', () => {
      expect(FileReadTool.isConcurrencySafe({})).toBe(true)
    })

    it('should not be destructive', () => {
      expect(FileReadTool.isDestructive({})).toBe(false)
    })
  })
})
