import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import path from 'path'
import { mkdirSync, rmSync } from 'fs'

// 在导入 app 之前设置环境变量，让 workspace.ts 读取
process.env.WORKSPACE_BASE = path.join(process.env.TEMP || 'C:\\temp', 'agenthive-wf-test')

import app from '../../src/app'
import { resetData } from '../utils/test-db'

const MOCK_BASE = process.env.WORKSPACE_BASE!

describe('API Workflow Integration Tests', () => {
  beforeEach(async () => {
    await resetData()
    // 创建基础目录
    await mkdir(MOCK_BASE, { recursive: true })
    // 创建测试环境可能用到的子目录（userId 可能是 test-user-id 或 anonymous）
    await mkdir(path.join(MOCK_BASE, 'test-user-id', 'default'), { recursive: true })
    await mkdir(path.join(MOCK_BASE, 'anonymous', 'default'), { recursive: true })
  })

  afterAll(() => {
    rmSync(MOCK_BASE, { recursive: true, force: true })
  })

  describe('完整业务工作流程', () => {
    it('应该完成获取 Agents -> 创建任务 -> 分配任务 的流程', async () => {
      const agentsRes = await request(app).get('/api/agents')
      expect(agentsRes.status).toBe(200)
      expect(agentsRes.body.code).toBe(200)
      const agentId = agentsRes.body.data.items[0].id

      const createTaskRes = await request(app)
        .post('/api/tasks')
        .send({ title: 'WF Task', type: 'feature', assignedTo: agentId })

      expect(createTaskRes.status).toBe(201)
      expect(createTaskRes.body.code).toBe(201)

      const taskRes = await request(app).get(`/api/tasks/${createTaskRes.body.data.id}`)
      expect(taskRes.status).toBe(200)
      expect(taskRes.body.code).toBe(200)
    })
  })

  describe('Agent 状态管理流程', () => {
    it('应该完成启动 -> 暂停 -> 恢复 -> 停止 Agent 的流程', async () => {
      const agentsRes = await request(app).get('/api/agents')
      const agentId = agentsRes.body.data.items[0].id

      expect((await request(app).post(`/api/agents/${agentId}/start`)).status).toBe(200)
      expect((await request(app).post(`/api/agents/${agentId}/pause`)).status).toBe(200)
      expect((await request(app).post(`/api/agents/${agentId}/resume`)).status).toBe(200)
      expect((await request(app).post(`/api/agents/${agentId}/stop`)).status).toBe(200)
    })
  })

  describe('代码编辑工作流程', () => {
    it('应该完成创建文件 -> 更新文件 -> 搜索文件 的流程', async () => {
      // 创建文件
      const r1 = await request(app)
        .post('/api/code/workspace/files/save')
        .send({ filePath: 'src/components/NewComp.vue', content: '<template><div>New</div></template>' })
      expect(r1.status).toBe(200)

      // 更新文件
      const r2 = await request(app)
        .post('/api/code/workspace/files/save')
        .send({ filePath: 'src/components/NewComp.vue', content: '<template><div>Updated</div></template>' })
      expect(r2.status).toBe(200)

      // 搜索文件
      const r3 = await request(app)
        .get('/api/code/workspace/search')
        .query({ query: 'Updated' })
      expect(r3.status).toBe(200)
      expect(r3.body.code).toBe(200)
    })
  })

  describe('错误处理', () => {
    it('应该正确处理 404 错误', async () => {
      const response = await request(app).get('/api/non-existent-route')
      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })

    it('应该正确处理验证错误', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({})
      expect(response.status).toBe(400)
      expect(response.body.code).toBe(400)
    })
  })

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app).get('/api/health')
      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)
    })
  })
})
