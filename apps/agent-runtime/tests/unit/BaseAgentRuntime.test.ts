/**
 * BaseAgentRuntime Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { BaseAgentRuntime } from '../../src/services/BaseAgentRuntime.js'
import type { AgentConfig, Task, Command } from '../../src/types/index.js'

// Mock dependencies
vi.mock('../../src/services/websocket-client.js', () => {
  return {
    WebSocketClient: vi.fn().mockImplementation(() => {
      const handlers: Record<string, Function[]> = {}
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        on: vi.fn((event: string, handler: Function) => {
          if (!handlers[event]) handlers[event] = []
          handlers[event].push(handler)
        }),
        _emit: (event: string, data: any) => {
          handlers[event]?.forEach((h) => h(data))
        },
        isReady: vi.fn().mockReturnValue(true)
      }
    })
  }
})

vi.mock('../../src/services/filesystem.js', () => ({
  FileSystemService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined)
  }))
}))

class TestRuntime extends BaseAgentRuntime {
  protected getRuntimeName() {
    return 'test'
  }
  protected getAvailableTools() {
    return ['tool1']
  }
  protected getRegisterCapabilities() {
    return ['cap1']
  }
  protected async handleRunTask(_task: Task) {
    /* mock */
  }
  protected async handleCancelTask() {
    /* mock */
  }
  protected getExecutorManager() {
    return new EventEmitter()
  }
}

const createConfig = (): AgentConfig => ({
  id: 'test-agent',
  name: 'Test Agent',
  role: 'backend_dev',
  supervisorUrl: 'ws://localhost:8080',
  workspacePath: '/tmp/test-workspace',
  capabilities: ['cap1'],
  maxConcurrentTasks: 1,
  heartbeatInterval: 5000
})

describe('BaseAgentRuntime', () => {
  let runtime: TestRuntime

  beforeEach(() => {
    runtime = new TestRuntime(createConfig())
  })

  describe('start()', () => {
    it('should initialize and emit started event', async () => {
      const startedSpy = vi.fn()
      runtime.on('started', startedSpy)

      await runtime.start()

      expect(runtime.getStatus()).toBe('idle')
      expect(startedSpy).toHaveBeenCalledTimes(1)
    })

    it('should start heartbeat timer', async () => {
      await runtime.start()
      expect((runtime as any).heartbeatTimer).not.toBeNull()
    })

    it('should call register via wsClient.send with correct payload', async () => {
      await runtime.start()

      const wsClient = (runtime as any).wsClient
      const registerCall = wsClient.send.mock.calls.find(
        (call: any[]) => call[0] === 'agent:register'
      )

      expect(registerCall).toBeDefined()
      expect(registerCall[1]).toMatchObject({
        id: 'test-agent',
        name: 'Test Agent',
        role: 'backend_dev',
        capabilities: ['cap1'],
        status: 'idle',
        tools: ['tool1']
      })
    })

    it('should set status to error on failure', async () => {
      const fs = (runtime as any).fileSystem
      fs.initialize.mockRejectedValueOnce(new Error('FS init failed'))

      await expect(runtime.start()).rejects.toThrow('FS init failed')
      expect(runtime.getStatus()).toBe('error')
    })
  })

  describe('stop()', () => {
    it('should clear heartbeat timer and emit stopped event', async () => {
      await runtime.start()
      const stoppedSpy = vi.fn()
      runtime.on('stopped', stoppedSpy)

      await runtime.stop()

      expect((runtime as any).heartbeatTimer).toBeNull()
      expect(stoppedSpy).toHaveBeenCalledTimes(1)
      expect(runtime.getStatus()).toBe('shutdown')
    })

    it('should be idempotent when called multiple times', async () => {
      await runtime.start()
      await runtime.stop()
      const stoppedSpy = vi.fn()
      runtime.on('stopped', stoppedSpy)

      await runtime.stop() // should not throw or emit again

      expect(stoppedSpy).not.toHaveBeenCalled()
      expect(runtime.getStatus()).toBe('shutdown')
    })
  })

  describe('pause() / resume()', () => {
    it('should pause when not working', async () => {
      const pausedSpy = vi.fn()
      runtime.on('paused', pausedSpy)

      await runtime.pause()

      expect(runtime.getStatus()).toBe('paused')
      expect(pausedSpy).toHaveBeenCalledTimes(1)
    })

    it('should not pause when working', async () => {
      ;(runtime as any).status = 'working'
      const pausedSpy = vi.fn()
      runtime.on('paused', pausedSpy)

      await runtime.pause()

      expect(pausedSpy).not.toHaveBeenCalled()
      expect(runtime.getStatus()).toBe('working')
    })

    it('should resume from paused', async () => {
      await runtime.pause()
      const resumedSpy = vi.fn()
      runtime.on('resumed', resumedSpy)

      await runtime.resume()

      expect(runtime.getStatus()).toBe('idle')
      expect(resumedSpy).toHaveBeenCalledTimes(1)
    })

    it('should not resume when not paused', async () => {
      const resumedSpy = vi.fn()
      runtime.on('resumed', resumedSpy)

      await runtime.resume()

      expect(resumedSpy).not.toHaveBeenCalled()
      expect(runtime.getStatus()).toBe('idle')
    })
  })

  describe('executeCommand()', () => {
    it('should dispatch pause command', async () => {
      await runtime.executeCommand({
        type: 'pause',
        payload: {},
        timestamp: Date.now().toString()
      })
      expect(runtime.getStatus()).toBe('paused')
    })

    it('should dispatch resume command', async () => {
      await runtime.pause()
      await runtime.executeCommand({
        type: 'resume',
        payload: {},
        timestamp: Date.now().toString()
      })
      expect(runtime.getStatus()).toBe('idle')
    })

    it('should dispatch shutdown command', async () => {
      await runtime.start()
      await runtime.executeCommand({
        type: 'shutdown',
        payload: {},
        timestamp: Date.now().toString()
      })
      expect(runtime.getStatus()).toBe('shutdown')
    })

    it('should dispatch run_task command', async () => {
      const handleRunTaskSpy = vi.spyOn(runtime as any, 'handleRunTask').mockResolvedValue(undefined)
      const task: Task = {
        id: 'task-1',
        type: 'test',
        status: 'running',
        priority: 'medium',
        title: 'Test Task',
        input: {},
        progress: 0,
        createdAt: new Date().toISOString()
      }

      await runtime.executeCommand({
        type: 'run_task',
        payload: task as unknown as Record<string, unknown>,
        timestamp: Date.now().toString()
      })

      expect(handleRunTaskSpy).toHaveBeenCalledWith(task)
    })

    it('should dispatch cancel_task command', async () => {
      const handleCancelTaskSpy = vi.spyOn(runtime as any, 'handleCancelTask').mockResolvedValue(undefined)

      await runtime.executeCommand({
        type: 'cancel_task',
        payload: {},
        timestamp: Date.now().toString()
      })

      expect(handleCancelTaskSpy).toHaveBeenCalled()
    })
  })

  describe('getters', () => {
    it('should return correct status', () => {
      expect(runtime.getStatus()).toBe('idle')
    })

    it('should return current task', () => {
      const task: Task = {
        id: 'task-1',
        type: 'test',
        status: 'running',
        priority: 'medium',
        title: 'Test Task',
        input: {},
        progress: 0,
        createdAt: new Date().toISOString()
      }
      ;(runtime as any).currentTask = task
      expect(runtime.getCurrentTask()).toBe(task)
    })

    it('should return null when no current task', () => {
      expect(runtime.getCurrentTask()).toBeNull()
    })

    it('should return config', () => {
      const config = runtime.getConfig()
      expect(config.id).toBe('test-agent')
      expect(config.name).toBe('Test Agent')
      expect(config.role).toBe('backend_dev')
    })
  })
})
