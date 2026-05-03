import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import path from 'path'
import { mkdir, rm } from 'fs/promises'

// Import the actual module to spy on it
import { getWorkspacePath as originalGetWorkspacePath } from '../../src/config/workspace.js'
import app from '../../src/app'
import { resetData } from '../utils/test-db'

const TEST_BASE = path.join(process.env.TEMP || 'C:\\temp', 'agenthive-workspace-test')

describe('Code Controller', () => {
  beforeEach(async () => {
    await resetData()
    await mkdir(TEST_BASE, { recursive: true })
    // Spy on getWorkspacePath and make it return TEST_BASE
    vi.spyOn({ getWorkspacePath: originalGetWorkspacePath }, 'getWorkspacePath')
      .mockImplementation(() => TEST_BASE)
  })

  afterEach(async () => {
    await rm(TEST_BASE, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  describe('GET /api/code/workspace/files', () => {
    it('应该获取工作区文件列表', async () => {
      const response = await request(app)
        .get('/api/code/workspace/files')

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })

  describe('POST /api/code/workspace/files/save', () => {
    it('应该保存文件', async () => {
      const response = await request(app)
        .post('/api/code/workspace/files/save')
        .send({ filePath: 'test.txt', content: 'hello world' })

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })

  describe('POST /api/code/workspace/files/mkdir', () => {
    it('应该创建目录', async () => {
      const response = await request(app)
        .post('/api/code/workspace/files/mkdir')
        .send({ path: 'test-dir' })

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })
})
