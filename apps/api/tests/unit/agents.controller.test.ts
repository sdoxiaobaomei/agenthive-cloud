import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import { resetData } from '../utils/test-db.js'

describe('Agents Controller', () => {
  beforeEach(async () => {
    await resetData()
  })

  describe('GET /api/agents', () => {
    it('应该获取 Agent 列表', async () => {
      const response = await request(app)
        .get('/api/agents')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.agents).toBeInstanceOf(Array)
      expect(response.body.data.total).toBeGreaterThan(0)
    })
  })

  describe('GET /api/agents/:id', () => {
    it('应该获取 Agent 详情', async () => {
      // 先获取列表找到 ID
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .get(`/api/agents/${agentId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.agent.id).toBe(agentId)
      expect(response.body.data.stats).toBeDefined()
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/agents', () => {
    it('应该创建新 Agent', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({
          name: 'New Test Agent',
          role: 'backend_dev',
          description: 'A test agent',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('New Test Agent')
      expect(response.body.data.role).toBe('backend_dev')
      expect(response.body.data.status).toBe('idle')
    })

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({ name: 'Test' }) // 缺少 role

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('应该验证 name 必填', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({ role: 'frontend_dev' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('PATCH /api/agents/:id', () => {
    it('应该更新 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .patch(`/api/agents/${agentId}`)
        .send({ name: 'Updated Name' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('Updated Name')
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .patch('/api/agents/non-existent-id')
        .send({ name: 'New Name' })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('DELETE /api/agents/:id', () => {
    it('应该删除 Agent', async () => {
      // 先创建一个 Agent
      const createRes = await request(app)
        .post('/api/agents')
        .send({ name: 'To Delete', role: 'custom' })

      const agentId = createRes.body.data.id

      const response = await request(app)
        .delete(`/api/agents/${agentId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 确认已删除
      const getRes = await request(app).get(`/api/agents/${agentId}`)
      expect(getRes.status).toBe(404)
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .delete('/api/agents/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/agents/:id/start', () => {
    it('应该启动 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/start`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('working')
    })
  })

  describe('POST /api/agents/:id/stop', () => {
    it('应该停止 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/stop`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('idle')
    })
  })

  describe('POST /api/agents/:id/pause', () => {
    it('应该暂停 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/pause`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('paused')
    })
  })

  describe('POST /api/agents/:id/resume', () => {
    it('应该恢复 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      // 先暂停
      await request(app).post(`/api/agents/${agentId}/pause`)

      // 再恢复
      const response = await request(app)
        .post(`/api/agents/${agentId}/resume`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('working')
    })
  })

  describe('POST /api/agents/:id/command', () => {
    it('应该发送命令', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/command`)
        .send({
          type: 'run_task',
          payload: { taskId: 'task-123' },
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.commandId).toBeDefined()
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .post('/api/agents/non-existent-id/command')
        .send({ type: 'test' })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/agents/:id/logs', () => {
    it('应该获取 Agent 日志', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .get(`/api/agents/${agentId}/logs`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.logs).toBeInstanceOf(Array)
    })

    it('应该支持 lines 参数', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.agents[0].id

      const response = await request(app)
        .get(`/api/agents/${agentId}/logs?lines=5`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})
