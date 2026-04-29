import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/config/database.js', () => ({
  pool: {
    query: vi.fn(),
  },
}))

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(0),
  },
  key: (ns: string, id: string) => `agenthive:${ns}:${id}`,
}))

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([
    { name: 'index.html', isFile: () => true },
    { name: 'style.css', isFile: () => true },
    { name: 'dist', isFile: () => false },
  ]),
}))

import { pool } from '../../src/config/database.js'
import {
  generateDeployConfig,
  deployProject,
  stopDeployment,
  findDeployment,
  createDeploymentRecord,
  updateDeploymentStatus,
  deleteDeploymentRecord,
  notifyJavaCreateHostedWebsite,
} from '../../src/project/hosting-service.js'

const mockQuery = pool.query as ReturnType<typeof vi.fn>

describe('Hosting Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.MOCK_JAVA_API
  })

  describe('generateDeployConfig', () => {
    it('应为静态站点生成 nginx + dockerfile 配置', async () => {
      const config = await generateDeployConfig('proj-1', '/data/workspaces/user/proj-1', 'vue')

      expect(config.dockerfile).toContain('nginx:alpine')
      expect(config.nginxConfig).toContain('server_name')
      expect(config.staticFiles).toContain('index.html')
      expect(config.staticFiles).toContain('style.css')
    })

    it('无 techStack 时应默认为静态配置', async () => {
      const config = await generateDeployConfig('proj-1', '/data/workspaces/user/proj-1')

      expect(config.dockerfile).toContain('nginx:alpine')
    })

    it('未知技术栈时回退到 node 配置', async () => {
      const config = await generateDeployConfig('proj-1', '/data/workspaces/user/proj-1', 'unknown-stack')

      expect(config.dockerfile).toContain('node:20-alpine')
    })
  })

  describe('createDeploymentRecord', () => {
    it('应插入或更新部署记录', async () => {
      const record = {
        id: 'dep-1',
        project_id: 'proj-1',
        status: 'deploying',
        access_url: 'https://proj-1.agenthive.io',
      }
      mockQuery.mockResolvedValue({ rows: [record] })

      const config = { dockerfile: 'FROM nginx', nginxConfig: 'server {}', staticFiles: ['index.html'] }
      const result = await createDeploymentRecord('proj-1', config)

      expect(result.project_id).toBe('proj-1')
      expect(result.status).toBe('deploying')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO project_deployments'),
        expect.any(Array)
      )
    })
  })

  describe('findDeployment', () => {
    it('应返回存在的部署记录', async () => {
      const record = { id: 'dep-1', project_id: 'proj-1', status: 'deployed' }
      mockQuery.mockResolvedValue({ rows: [record] })

      const result = await findDeployment('proj-1')

      expect(result).toEqual(record)
    })

    it('无记录时应返回 undefined', async () => {
      mockQuery.mockResolvedValue({ rows: [] })

      const result = await findDeployment('proj-1')

      expect(result).toBeUndefined()
    })
  })

  describe('updateDeploymentStatus', () => {
    it('应更新状态', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 })

      await updateDeploymentStatus('proj-1', 'deployed')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE project_deployments'),
        ['deployed', 'proj-1']
      )
    })
  })

  describe('deleteDeploymentRecord', () => {
    it('应删除记录', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 })

      const result = await deleteDeploymentRecord('proj-1')

      expect(result).toBe(true)
    })
  })

  describe('deployProject', () => {
    it('应生成配置、创建记录并返回 accessUrl', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'dep-1', project_id: 'proj-1', status: 'deploying', access_url: 'https://proj-1.agenthive.io' }] })

      const result = await deployProject('proj-1', '/data/workspaces/user/proj-1', 'react')

      expect(result.accessUrl).toContain('proj-1')
      expect(result.status).toBe('failed') // because Java API is not available in test
    })
  })

  describe('stopDeployment', () => {
    it('应删除部署记录并返回 success', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 })

      const result = await stopDeployment('proj-1')

      expect(result.success).toBe(true)
    })
  })

  describe('notifyJavaCreateHostedWebsite', () => {
    it('Java API 可用时应返回 true', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'hw-1' }),
      } as any)

      const result = await notifyJavaCreateHostedWebsite({
        projectId: 'proj-1',
        accessUrl: 'https://proj-1.agenthive.io',
        config: { dockerfile: 'FROM nginx', nginxConfig: 'server {}', staticFiles: [] },
      })

      expect(result).toBe(true)
    })

    it('Java API 不可用时返回 false', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

      const result = await notifyJavaCreateHostedWebsite({
        projectId: 'proj-1',
        accessUrl: 'https://proj-1.agenthive.io',
        config: { dockerfile: 'FROM nginx', nginxConfig: 'server {}', staticFiles: [] },
      })

      expect(result).toBe(false)
    })
  })
})
