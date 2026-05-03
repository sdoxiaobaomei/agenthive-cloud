import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { resetData } from '../utils/test-db'

describe('Tasks Controller', () => {
  beforeEach(async () => {
    await resetData()
  })

  describe('GET /api/tasks', () => {
    it('应该获取任务列表', async () => {
      const response = await request(app)
        .get('/api/tasks')

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.items).toBeInstanceOf(Array)
      expect(response.body.data.total).toBeGreaterThan(0)
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('应该获取任务详情', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.items[0].id

      const response = await request(app)
        .get(`/api/tasks/${taskId}`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.id).toBe(taskId)
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .get('/api/tasks/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('POST /api/tasks', () => {
    it('应该创建新任务', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'New Task', type: 'feature' })

      expect(response.status).toBe(201)
      expect(response.body.code).toBe(201)
      expect(response.body.data.title).toBe('New Task')
    })

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.code).toBe(400)
    })

    it('应该验证 title 必填', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ type: 'feature' })

      expect(response.status).toBe(400)
      expect(response.body.code).toBe(400)
    })
  })

  describe('PATCH /api/tasks/:id', () => {
    it('应该更新任务', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.items[0].id

      const response = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ title: 'Updated Task' })

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.title).toBe('Updated Task')
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .patch('/api/tasks/non-existent-id')
        .send({ title: 'Updated Task' })

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('DELETE /api/tasks/:id', () => {
    it('应该删除任务', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.items[0].id

      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .delete('/api/tasks/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('POST /api/tasks/:id/cancel', () => {
    it('应该取消任务', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.items[0].id

      const response = await request(app)
        .post(`/api/tasks/${taskId}/cancel`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .post('/api/tasks/non-existent-id/cancel')

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })

  describe('GET /api/tasks/:id/subtasks', () => {
    it('应该获取子任务', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.items[0].id

      const response = await request(app)
        .get(`/api/tasks/${taskId}/subtasks`)

      expect(response.status).toBe(200)
      expect(response.body.code).toBe(200)
      expect(response.body.data.subtasks).toBeInstanceOf(Array)
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .get('/api/tasks/non-existent-id/subtasks')

      expect(response.status).toBe(404)
      expect(response.body.code).toBe(404)
    })
  })
})
