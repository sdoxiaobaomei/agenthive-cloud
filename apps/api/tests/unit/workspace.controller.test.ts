// Workspace Controller 单元测试（FEAT-002b + FEAT-002c）
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 依赖
vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    request: vi.fn(),
  },
}))

vi.mock('../../src/utils/database.js', () => ({
  codeDb: {},
  delay: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  rename: vi.fn(),
  access: vi.fn(),
}))

vi.mock('fs', () => ({
  createReadStream: vi.fn(),
}))

vi.mock('multer', () => {
  const memoryStorage = vi.fn()
  const multerFn = vi.fn(() => ({
    array: vi.fn(),
  }))
  multerFn.memoryStorage = memoryStorage
  return {
    default: multerFn,
    memoryStorage,
  }
})

import { rm, rename, readdir, stat, access } from 'fs/promises'
import {
  batchDeleteWorkspaceFiles,
  batchMoveWorkspaceFiles,
  searchWorkspaceFiles,
  getWorkspaceGitStatus,
} from '../../src/controllers/code.js'

// Mock child_process.exec 用于 git 状态查询
vi.mock('child_process', () => ({
  exec: vi.fn((_cmd, _opts, cb) => {
    if (cb) cb(null as any, '', '')
  }),
}))

function mockReq(options: { body?: any; query?: any; userId?: string } = {}) {
  return {
    body: options.body || {},
    query: options.query || {},
    userId: options.userId || 'test-user',
  } as any
}

function mockRes() {
  const jsonFn = vi.fn()
  const statusFn = vi.fn().mockReturnThis()
  return {
    status: statusFn,
    json: jsonFn,
    setHeader: vi.fn(),
  } as any
}

describe('Workspace Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WORKSPACE_BASE = '/data/workspaces'
  })

  describe('batchDeleteWorkspaceFiles', () => {
    it('应成功批量删除文件', async () => {
      const mockRm = rm as ReturnType<typeof vi.fn>
      mockRm.mockResolvedValue(undefined)

      const req = mockReq({
        body: {
          paths: ['file1.txt', 'file2.txt'],
        },
      })
      const res = mockRes()

      await batchDeleteWorkspaceFiles(req, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 200,
          data: expect.objectContaining({
            succeeded: ['file1.txt', 'file2.txt'],
            failed: [],
            total: 2,
          }),
        })
      )
      expect(mockRm).toHaveBeenCalledTimes(2)
    })

    it('路径越界时应放入 failed 数组', async () => {
      const mockRm = rm as ReturnType<typeof vi.fn>
      mockRm.mockResolvedValue(undefined)

      const req = mockReq({
        body: {
          paths: ['file1.txt', '../../../etc/passwd'],
        },
      })
      const res = mockRes()

      await batchDeleteWorkspaceFiles(req, res)

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(jsonCall.data.succeeded).toEqual(['file1.txt'])
      expect(jsonCall.data.failed).toHaveLength(1)
      expect(jsonCall.data.failed[0].path).toBe('../../../etc/passwd')
      expect(jsonCall.data.failed[0].error).toContain('超出工作区范围')
    })

    it('文件不存在时应记录失败', async () => {
      const mockRm = rm as ReturnType<typeof vi.fn>
      mockRm.mockRejectedValueOnce({ code: 'ENOENT', message: 'not found' })
        .mockResolvedValueOnce(undefined)

      const req = mockReq({
        body: {
          paths: ['missing.txt', 'exists.txt'],
        },
      })
      const res = mockRes()

      await batchDeleteWorkspaceFiles(req, res)

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(jsonCall.data.succeeded).toEqual(['exists.txt'])
      expect(jsonCall.data.failed).toHaveLength(1)
      expect(jsonCall.data.failed[0].error).toContain('不存在')
    })

    it('paths 为空数组应返回 400', async () => {
      const req = mockReq({ body: { paths: [] } })
      const res = mockRes()

      await batchDeleteWorkspaceFiles(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe('batchMoveWorkspaceFiles', () => {
    it('应成功批量移动文件', async () => {
      const mockRename = rename as ReturnType<typeof vi.fn>
      const mockStat = stat as ReturnType<typeof vi.fn>
      mockStat.mockRejectedValue({ code: 'ENOENT' })
      mockRename.mockResolvedValue(undefined)

      const req = mockReq({
        body: {
          operations: [
            { sourcePath: 'old1.txt', targetPath: 'new1.txt' },
            { sourcePath: 'old2.txt', targetPath: 'new2.txt' },
          ],
        },
      })
      const res = mockRes()

      await batchMoveWorkspaceFiles(req, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 200,
          data: expect.objectContaining({
            succeeded: expect.arrayContaining([
              { sourcePath: 'old1.txt', targetPath: 'new1.txt' },
              { sourcePath: 'old2.txt', targetPath: 'new2.txt' },
            ]),
            failed: [],
            total: 2,
          }),
        })
      )
    })

    it('目标已存在时应跳过并记录失败', async () => {
      const mockStat = stat as ReturnType<typeof vi.fn>
      mockStat.mockResolvedValue({ isDirectory: () => false }) // 目标已存在

      const req = mockReq({
        body: {
          operations: [
            { sourcePath: 'old.txt', targetPath: 'existing.txt' },
          ],
        },
      })
      const res = mockRes()

      await batchMoveWorkspaceFiles(req, res)

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(jsonCall.data.succeeded).toHaveLength(0)
      expect(jsonCall.data.failed).toHaveLength(1)
      expect(jsonCall.data.failed[0].error).toContain('已存在')
    })

    it('路径越界时应放入 failed 数组', async () => {
      const req = mockReq({
        body: {
          operations: [
            { sourcePath: '../../../etc/passwd', targetPath: 'safe.txt' },
          ],
        },
      })
      const res = mockRes()

      await batchMoveWorkspaceFiles(req, res)

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(jsonCall.data.succeeded).toHaveLength(0)
      expect(jsonCall.data.failed[0].error).toContain('超出工作区范围')
    })

    it('operations 为空应返回 400', async () => {
      const req = mockReq({ body: { operations: [] } })
      const res = mockRes()

      await batchMoveWorkspaceFiles(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe('searchWorkspaceFiles', () => {
    it('应返回匹配的文件', async () => {
      const mockReaddir = readdir as ReturnType<typeof vi.fn>
      const mockStatFn = stat as ReturnType<typeof vi.fn>

      mockReaddir.mockResolvedValueOnce([
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'readme.md', isDirectory: () => false, isFile: () => true },
        { name: 'main.ts', isDirectory: () => false, isFile: () => true },
      ]).mockResolvedValueOnce([
        { name: 'index.ts', isDirectory: () => false, isFile: () => true },
      ])

      mockStatFn.mockResolvedValue({
        size: 100,
        mtime: new Date('2024-01-01'),
      })

      const req = mockReq({
        query: { query: 'index', projectId: 'proj-1' },
      })
      const res = mockRes()

      await searchWorkspaceFiles(req, res)

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(jsonCall.code).toBe(200)
      expect(jsonCall.data.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'index.ts' }),
        ])
      )
      expect(jsonCall.data.query).toBe('index')
    })

    it('query 为空时应返回 400', async () => {
      const req = mockReq({ query: { query: '', projectId: 'proj-1' } })
      const res = mockRes()

      await searchWorkspaceFiles(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 400 })
      )
    })

    it('工作区不存在时应返回 404', async () => {
      const mockReaddir = readdir as ReturnType<typeof vi.fn>
      mockReaddir.mockRejectedValue({ code: 'ENOENT' })

      const req = mockReq({
        query: { query: 'test', projectId: 'proj-1' },
      })
      const res = mockRes()

      await searchWorkspaceFiles(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })
  })

  describe('getWorkspaceGitStatus', () => {
    it('非 git 仓库应返回 400', async () => {
      const mockAccess = access as ReturnType<typeof vi.fn>
      mockAccess.mockRejectedValue(new Error('ENOENT'))

      const req = mockReq({
        query: { projectId: 'proj-1' },
      })
      const res = mockRes()

      await getWorkspaceGitStatus(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('不是 Git 仓库') })
      )
    })

    it('git 仓库应返回状态信息', async () => {
      const mockAccess = access as ReturnType<typeof vi.fn>
      mockAccess.mockResolvedValue(undefined)

      // child_process.exec 已在模块顶部 mock，但它在 controller 内部用闭包引用
      // 由于 exec 在 code.ts 中被直接 import，我们的 child_process mock 需要返回正确的回调行为
      // 但 controller 内部定义了 execAsync 包装函数，它调用了 exec
      // 由于 exec 被 vitest 自动 mock 为 vi.fn()，每次调用返回 undefined（因为没有返回值设置）
      // 而 execAsync 期望 callback 被调用，所以 exec 的 mock 需要模拟 callback 调用
      // 我们在顶部 mock 的 child_process.exec 已经处理了 callback，但现在需要让它根据不同命令返回不同结果

      const { exec } = await import('child_process')
      const mockExec = exec as unknown as ReturnType<typeof vi.fn>

      // execAsync 包装了 exec，传入 callback，然后 resolve/reject
      // 我们在顶部 mock 中已经处理了 callback 调用，但所有命令都返回空字符串
      // 需要让不同命令返回不同值
      mockExec.mockImplementation((cmd: string, _opts: any, cb: any) => {
        let stdout = ''
        if (cmd.includes('branch --show-current')) stdout = 'main'
        else if (cmd.includes('rev-parse --short')) stdout = 'abc1234'
        else if (cmd.includes('status --porcelain')) stdout = ' M readme.md\n?? untracked.txt'
        else if (cmd.includes('rev-list --count HEAD..@{upstream}')) stdout = '2'
        else if (cmd.includes('rev-list --count @{upstream}..HEAD')) stdout = '3'
        if (cb) cb(null as any, stdout, '')
      })

      const req = mockReq({
        query: { projectId: 'proj-1' },
      })
      const res = mockRes()

      await getWorkspaceGitStatus(req, res)

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(jsonCall.code).toBe(200)
      expect(jsonCall.data.branch).toBe('main')
      expect(jsonCall.data.commit).toBe('abc1234')
      expect(jsonCall.data.modified).toContain('readme.md')
      expect(jsonCall.data.untracked).toContain('untracked.txt')
      expect(jsonCall.data.ahead).toBe(3)
      expect(jsonCall.data.behind).toBe(2)
    })

    it('无 upstream 分支时 ahead/behind 应为 null', async () => {
      const mockAccess = access as ReturnType<typeof vi.fn>
      mockAccess.mockResolvedValue(undefined)

      const { exec } = await import('child_process')
      const mockExec = exec as unknown as ReturnType<typeof vi.fn>

      mockExec.mockImplementation((cmd: string, _opts: any, cb: any) => {
        let stdout = ''
        let err = null
        if (cmd.includes('branch --show-current')) stdout = 'feature'
        else if (cmd.includes('rev-parse --short')) stdout = 'def5678'
        else if (cmd.includes('status --porcelain')) stdout = ''
        else if (cmd.includes('rev-list')) {
          err = new Error('no upstream') // 模拟无上游分支
        }
        if (cb) cb(err as any, stdout, '')
      })

      const req = mockReq({
        query: { projectId: 'proj-1' },
      })
      const res = mockRes()

      await getWorkspaceGitStatus(req, res)

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(jsonCall.data.ahead).toBeNull()
      expect(jsonCall.data.behind).toBeNull()
    })
  })
})
