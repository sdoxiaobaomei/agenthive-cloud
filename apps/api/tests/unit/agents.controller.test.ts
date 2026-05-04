import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { resetData } from '../utils/test-db'

describe('Agents Controller', () => {
  beforeEach(async () => {
    await resetData()
  })

  describe('GET /api/agents', () => {
    it('应该获取 Agent 列表', async () => {
      const response = await request(app)
        .get('/api/agents')

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.items).toBeInstanceOf(Array)
      expect(response.body.data.total).toBeGreaterThan(0)
    })
  })

  describe('GET /api/agents/:id', () => {
    it('应该获取 Agent 详情', async () => {
      // 先获取列表找到 ID
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .get(`/api/agents/${agentId}`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.agent.id).toBe(agentId)
      expect(response.body.data.stats).toBeDefined()
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('POST /api/agents', () => {
    it('应该创建新 Agent', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({ name: 'New Agent', role: 'coder' })

      expect(response.status).toBe(201)
      expect(response.body.code).toBe(201)
      expect(response.body.data.name).toBe('New Agent')
    })

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.code).toBe(400)
    })

    it('应该验证 name 必填', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({ role: 'coder' })

      expect(response.status).toBe(400)
      expect(response.body.code).toBe(400)
    })
  })

  describe('PATCH /api/agents/:id', () => {
    it('应该更新 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .patch(`/api/agents/${agentId}`)
        .send({ name: 'Updated Agent' })

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.name).toBe('Updated Agent')
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .patch('/api/agents/non-existent-id')
        .send({ name: 'Updated Agent' })

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('DELETE /api/agents/:id', () => {
    it('应该删除 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .delete(`/api/agents/${agentId}`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .delete('/api/agents/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('POST /api/agents/:id/start', () => {
    it('应该启动 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/start`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })

  describe('POST /api/agents/:id/stop', () => {
    it('应该停止 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/stop`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })

  describe('POST /api/agents/:id/pause', () => {
    it('应该暂停 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/pause`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })

  describe('POST /api/agents/:id/resume', () => {
    it('应该恢复 Agent', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/resume`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })

  describe('POST /api/agents/:id/command', () => {
    it('应该发送命令', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .post(`/api/agents/${agentId}/command`)
        .send({ type: 'ping' })

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })

    it('应该返回 404 对于不存在的 Agent', async () => {
      const response = await request(app)
        .post('/api/agents/non-existent-id/command')
        .send({ type: 'ping' })

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('GET /api/agents/:id/logs', () => {
    it('应该获取 Agent 日志', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .get(`/api/agents/${agentId}/logs`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.logs).toBeInstanceOf(Array)
    })

    it('应该支持 lines 参数', async () => {
      const listRes = await request(app).get('/api/agents')
      const agentId = listRes.body.data.items[0].id

      const response = await request(app)
        .get(`/api/agents/${agentId}/logs?lines=5`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })
  })
})
