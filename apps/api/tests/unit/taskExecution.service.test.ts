// Task Execution Service 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}))

// Mock WebSocket hub
vi.mock('../../src/websocket/hub.js', () => ({
  broadcast: {
    taskProgress: vi.fn(),
    agentStatus: vi.fn(),
  },
}))

// Mock LLM service
vi.mock('../../src/services/llm.js', () => ({
  getLLMService: vi.fn(),
}))

import { mkdir, writeFile } from 'fs/promises'
import { broadcast } from '../../src/websocket/hub.js'
import { getLLMService } from '../../src/services/llm.js'
import { TaskExecutionService, TaskInfo } from '../../src/services/taskExecution.js'

const mockBroadcastTaskProgress = broadcast.taskProgress as ReturnType<typeof vi.fn>
const mockGetLLMService = getLLMService as ReturnType<typeof vi.fn>
const mockMkdir = mkdir as ReturnType<typeof vi.fn>
const mockWriteFile = writeFile as ReturnType<typeof vi.fn>

/**
 * 创建一个可控的异步流，用于测试并发和运行状态。
 * 流在 yield 第一个 chunk 后暂停，直到调用 end()。
 */
function createDeferredStream() {
  let resume: (() => void) | null = null
  const wait = () => new Promise<void>((r) => { resume = r })

  const stream = async function* () {
    yield { content: 'start' }
    await wait() // 暂停直到测试调用 end()
    yield { content: 'end', usage: { total_tokens: 10 } }
  }

  return {
    stream,
    end: () => { if (resume) resume() },
  }
}

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: 'task-001',
    title: 'Test Task',
    type: 'code_generation',
    userId: 'user-123',
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('TaskExecution Service', () => {
  let service: TaskExecutionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TaskExecutionService({
      workspaceBasePath: '/tmp/test-workspace',
      maxConcurrentTasks: 2,
    })
  })

  describe('execute', () => {
    it('应成功执行任务并完成状态更新', async () => {
      mockGetLLMService.mockReturnValue({
        stream: async function* () {
          yield { content: 'Hello ' }
          yield { content: 'world', usage: { prompt_tokens: 10, completion_tokens: 5 } }
        },
      })

      const task = createTask()
      const result = await service.execute(task)

      expect(result.status).toBe('completed')
      expect(result.progress).toBe(100)
      expect(result.completedAt).toBeDefined()
      expect(result.result.success).toBe(true)
      expect(result.result.output.content).toBe('Hello world')
      expect(mockBroadcastTaskProgress).toHaveBeenCalledWith('task-001', 0, { status: 'running' })
      expect(mockBroadcastTaskProgress).toHaveBeenCalledWith('task-001', 100, expect.any(Object))
    })

    it('应创建工作区目录并保存结果文件', async () => {
      mockGetLLMService.mockReturnValue({
        stream: async function* () { yield { content: 'result' } },
      })

      const task = createTask({ projectId: 'proj-456' })
      await service.execute(task)

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('task-results'),
        { recursive: true }
      )
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('task-001.md'),
        'result',
        'utf-8'
      )
    })

    it('超过并发限制时应抛出错误', async () => {
      service = new TaskExecutionService({
        workspaceBasePath: '/tmp/test-workspace',
        maxConcurrentTasks: 1,
      })

      const deferred = createDeferredStream()
      mockGetLLMService.mockReturnValue({ stream: deferred.stream })

      const task1 = createTask({ id: 'task-001' })
      const execPromise = service.execute(task1)

      // 等待 task1 进入运行状态（yield 第一个 chunk 后暂停）
      await new Promise((r) => setTimeout(r, 30))

      const task2 = createTask({ id: 'task-002' })
      await expect(service.execute(task2)).rejects.toThrow('Too many concurrent tasks')

      deferred.end()
      await execPromise
    })

    it('重复执行同一运行中任务应抛出错误', async () => {
      const deferred = createDeferredStream()
      mockGetLLMService.mockReturnValue({ stream: deferred.stream })

      const task = createTask({ id: 'task-001' })
      const execPromise = service.execute(task)

      await new Promise((r) => setTimeout(r, 30))

      await expect(service.execute(task)).rejects.toThrow('Task is already running')

      deferred.end()
      await execPromise
    })

    it('LLM 调用返回失败时应标记任务为 failed', async () => {
      mockGetLLMService.mockReturnValue({
        stream: async function* () {
          throw new Error('LLM service unavailable')
        },
      })

      const task = createTask()
      const result = await service.execute(task)

      expect(result.status).toBe('failed')
      expect(result.result.success).toBe(false)
      expect(result.result.error).toContain('LLM service unavailable')
      expect(mockBroadcastTaskProgress).toHaveBeenCalledWith(
        'task-001',
        expect.any(Number),
        expect.objectContaining({ status: 'failed' })
      )
    })

    it('流式生成过程中应逐步更新进度', async () => {
      const chunks = Array.from({ length: 20 }, (_, i) => ({ content: `chunk${i}` }))
      mockGetLLMService.mockReturnValue({
        stream: async function* () {
          for (const chunk of chunks) yield chunk
        },
      })

      const task = createTask()
      await service.execute(task)

      // 进度应从 0 逐步增长到 100
      const progressCalls = mockBroadcastTaskProgress.mock.calls.filter(
        (call: any) => call[1] > 0 && call[1] < 100
      )
      expect(progressCalls.length).toBeGreaterThan(0)
    })
  })

  describe('cancel', () => {
    it('应取消运行中任务并返回 true', async () => {
      const deferred = createDeferredStream()
      mockGetLLMService.mockReturnValue({ stream: deferred.stream })

      const task = createTask({ id: 'task-cancel-001' })
      const execPromise = service.execute(task)

      await new Promise((r) => setTimeout(r, 30))

      const cancelled = await service.cancel('task-cancel-001')
      expect(cancelled).toBe(true)

      deferred.end()
      await execPromise
    })

    it('取消不存在的任务应返回 false', async () => {
      const result = await service.cancel('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('getTaskStatus', () => {
    it('应返回已执行任务的状态', async () => {
      mockGetLLMService.mockReturnValue({
        stream: async function* () { yield { content: 'done' } },
      })

      const task = createTask({ id: 'task-status-001' })
      await service.execute(task)

      const status = service.getTaskStatus('task-status-001')
      expect(status).toBeDefined()
      expect(status?.id).toBe('task-status-001')
      expect(status?.status).toBe('completed')
    })

    it('未执行的任务应返回 undefined', () => {
      const status = service.getTaskStatus('never-executed')
      expect(status).toBeUndefined()
    })
  })

  describe('getRunningTasks', () => {
    it('应返回当前运行中的任务列表', async () => {
      const deferred = createDeferredStream()
      mockGetLLMService.mockReturnValue({ stream: deferred.stream })

      const task = createTask({ id: 'task-running-001' })
      const execPromise = service.execute(task)

      await new Promise((r) => setTimeout(r, 30))

      const running = service.getRunningTasks()
      expect(running.some((t) => t.id === 'task-running-001')).toBe(true)

      deferred.end()
      await execPromise
    })

    it('没有运行中任务时应返回空数组', () => {
      expect(service.getRunningTasks()).toEqual([])
    })
  })

  describe('getSystemPrompt', () => {
    it('应返回 code_analysis 类型的特定提示词', () => {
      const prompt = (service as any).getSystemPrompt('code_analysis', '/workspace')
      expect(prompt).toContain('code analysis expert')
      expect(prompt).toContain('Architecture and design patterns')
    })

    it('应返回 code_generation 类型的特定提示词', () => {
      const prompt = (service as any).getSystemPrompt('code_generation', '/workspace')
      expect(prompt).toContain('code generation expert')
      expect(prompt).toContain('well-documented code')
    })

    it('未知类型应返回基础提示词', () => {
      const prompt = (service as any).getSystemPrompt('unknown_type', '/workspace')
      expect(prompt).toContain('AI assistant')
      expect(prompt).toContain('/workspace')
    })
  })

  describe('buildUserPrompt', () => {
    it('应包含任务标题和类型', () => {
      const task = createTask({ title: 'Refactor auth', description: undefined })
      const prompt = (service as any).buildUserPrompt(task, '/workspace')

      expect(prompt).toContain('Task: Refactor auth')
      expect(prompt).toContain('Task Type: code_generation')
      expect(prompt).toContain('Workspace: /workspace')
    })

    it('应包含描述和输入', () => {
      const task = createTask({
        title: 'Analyze API',
        description: 'Check REST endpoints',
        input: { endpoints: ['/api/users', '/api/tasks'] },
      })
      const prompt = (service as any).buildUserPrompt(task, '/workspace')

      expect(prompt).toContain('Description: Check REST endpoints')
      expect(prompt).toContain('/api/users')
    })

    it('无 input 时不应包含 Additional Input', () => {
      const task = createTask({ input: undefined })
      const prompt = (service as any).buildUserPrompt(task, '/workspace')

      expect(prompt).not.toContain('Additional Input')
    })
  })

  describe('getAvailableTools', () => {
    it('应返回可用工具列表', () => {
      const tools = service.getAvailableTools()
      expect(tools).toContain('llm_chat')
      expect(tools).toContain('file_analysis')
      expect(tools).toContain('code_generation')
    })
  })
})
