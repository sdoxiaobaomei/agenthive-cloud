// Project Service 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 依赖
vi.mock('../../src/config/database.js', () => ({
  pool: {
    query: vi.fn(),
  },
}))

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    request: vi.fn(),
  },
}))

import { pool } from '../../src/config/database.js'
import { projectService } from '../../src/project/service.js'

const mockQuery = pool.query as ReturnType<typeof vi.fn>

describe('Project Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAll', () => {
    it('无 userId 时应查询所有非删除项目', async () => {
      const projects = [
        { id: 'proj-1', name: 'Project Alpha', status: 'active', owner_id: 'user-1' },
        { id: 'proj-2', name: 'Project Beta', status: 'active', owner_id: 'user-2' },
      ]
      mockQuery.mockResolvedValue({ rows: projects })

      const result = await projectService.findAll()

      expect(result).toHaveLength(2)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status != $1'),
        ['deleted']
      )
    })

    it('有 userId 时应查询该用户的非删除项目', async () => {
      const projects = [
        { id: 'proj-1', name: 'Project Alpha', status: 'active', owner_id: 'user-1' },
      ]
      mockQuery.mockResolvedValue({ rows: projects })

      const result = await projectService.findAll('user-1')

      expect(result).toHaveLength(1)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND owner_id = $2'),
        ['deleted', 'user-1']
      )
    })

    it('应按 updated_at 降序排列', async () => {
      mockQuery.mockResolvedValue({ rows: [] })

      await projectService.findAll()

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY updated_at DESC'),
        expect.any(Array)
      )
    })
  })

  describe('findById', () => {
    it('项目存在时应返回项目', async () => {
      const project = { id: 'proj-1', name: 'Project Alpha', status: 'active' }
      mockQuery.mockResolvedValue({ rows: [project] })

      const result = await projectService.findById('proj-1')

      expect(result).toEqual(project)
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE id = $1',
        ['proj-1']
      )
    })

    it('项目不存在时应返回 undefined', async () => {
      mockQuery.mockResolvedValue({ rows: [] })

      const result = await projectService.findById('non-existent')

      expect(result).toBeUndefined()
    })
  })

  describe('create', () => {
    it('应创建新项目并返回', async () => {
      const created = {
        id: 'proj-new',
        name: 'New Project',
        description: 'A test project',
        repo_url: 'https://github.com/test/repo',
        owner_id: 'user-123',
        status: 'active',
      }
      mockQuery.mockResolvedValue({ rows: [created] })

      const result = await projectService.create({
        name: 'New Project',
        description: 'A test project',
        repo_url: 'https://github.com/test/repo',
        owner_id: 'user-123',
      })

      expect(result.name).toBe('New Project')
      expect(result.status).toBe('active')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['New Project', 'A test project', 'https://github.com/test/repo', 'user-123', 'active']
      )
    })

    it('description 和 repo_url 为空时应传入 null', async () => {
      const created = {
        id: 'proj-new',
        name: 'Minimal Project',
        description: null,
        repo_url: null,
        owner_id: 'user-123',
        status: 'active',
      }
      mockQuery.mockResolvedValue({ rows: [created] })

      await projectService.create({
        name: 'Minimal Project',
        owner_id: 'user-123',
      })

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['Minimal Project', null, null, 'user-123', 'active']
      )
    })
  })

  describe('update', () => {
    it('应更新项目并返回更新后的数据', async () => {
      const updated = {
        id: 'proj-1',
        name: 'Updated Name',
        description: 'Updated Desc',
        repo_url: 'https://new.url',
        status: 'archived',
      }
      mockQuery.mockResolvedValue({ rows: [updated] })

      const result = await projectService.update('proj-1', {
        name: 'Updated Name',
        description: 'Updated Desc',
        repo_url: 'https://new.url',
        status: 'archived',
      })

      expect(result?.name).toBe('Updated Name')
      expect(result?.status).toBe('archived')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects'),
        ['Updated Name', 'Updated Desc', 'https://new.url', 'archived', 'proj-1']
      )
    })

    it('项目不存在时应返回 undefined', async () => {
      mockQuery.mockResolvedValue({ rows: [] })

      const result = await projectService.update('non-existent', { name: 'New Name' })

      expect(result).toBeUndefined()
    })

    it('应使用 COALESCE 保留未提供的字段', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'proj-1', name: 'Only Name Updated' }] })

      await projectService.update('proj-1', { name: 'Only Name Updated' })

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE'),
        ['Only Name Updated', undefined, undefined, undefined, 'proj-1']
      )
    })
  })

  describe('delete', () => {
    it('应软删除项目并返回 true', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 })

      const result = await projectService.delete('proj-1')

      expect(result).toBe(true)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET status = $1'),
        ['deleted', 'proj-1']
      )
    })

    it('删除不存在项目时应返回 false', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 })

      const result = await projectService.delete('non-existent')

      expect(result).toBe(false)
    })
  })
})
