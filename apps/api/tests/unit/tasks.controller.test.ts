import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import { resetData } from '../utils/test-db.js'

describe('Tasks Controller', () => {
  beforeEach(() => {
    resetData()
  })

  describe('GET /api/tasks', () => {
    it('应该获取任务列表', async () => {
      const response = await request(app)
        .get('/api/tasks')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.tasks).toBeInstanceOf(Array)
      expect(response.body.data.total).toBeDefined()
      expect(response.body.data.page).toBeDefined()
      expect(response.body.data.pageSize).toBeDefined()
    })

    it('应该支持状态筛选', async () => {
      const response = await request(app)
        .get('/api/tasks?status=running')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.tasks).toBeInstanceOf(Array)
    })

    it('应该支持 Agent 筛选', async () => {
      const response = await request(app)
        .get('/api/tasks?assignedTo=agent-1')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    it('应该支持分页', async () => {
      const response = await request(app)
        .get('/api/tasks?page=1&pageSize=5')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.page).toBe(1)
      expect(response.body.data.pageSize).toBe(5)
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('应该获取任务详情', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.tasks[0].id

      const response = await request(app)
        .get(`/api/tasks/${taskId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(taskId)
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .get('/api/tasks/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/tasks', () => {
    it('应该创建新任务', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: 'New Test Task',
          type: 'feature',
          priority: 'high',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('New Test Task')
      expect(response.body.data.status).toBe('pending')
      expect(response.body.data.priority).toBe('high')
    })

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ type: 'feature' }) // 缺少 title

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('应该验证 type 必填', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test' }) // 缺少 type

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('应该使用默认优先级', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Test',
          type: 'bug',
        })

      expect(response.status).toBe(201)
      expect(response.body.data.priority).toBe('medium')
    })

    it('应该支持分配 Agent', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Assigned Task',
          type: 'feature',
          assignedTo: 'agent-1',
        })

      expect(response.status).toBe(201)
      expect(response.body.data.assignedTo).toBe('agent-1')
    })
  })

  describe('PATCH /api/tasks/:id', () => {
    it('应该更新任务', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.tasks[0].id

      const response = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({
          title: 'Updated Title',
          progress: 50,
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('Updated Title')
      expect(response.body.data.progress).toBe(50)
    })

    it('应该支持状态更新', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.tasks[0].id

      const response = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ status: 'completed' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('completed')
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .patch('/api/tasks/non-existent-id')
        .send({ title: 'New Title' })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('DELETE /api/tasks/:id', () => {
    it('应该删除任务', async () => {
      // 先创建一个任务
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ title: 'To Delete', type: 'feature' })

      const taskId = createRes.body.data.id

      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 确认已删除
      const getRes = await request(app).get(`/api/tasks/${taskId}`)
      expect(getRes.status).toBe(404)
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .delete('/api/tasks/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/tasks/:id/cancel', () => {
    it('应该取消任务', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.tasks[0].id

      const response = await request(app)
        .post(`/api/tasks/${taskId}/cancel`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('cancelled')
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .post('/api/tasks/non-existent-id/cancel')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/tasks/:id/subtasks', () => {
    it('应该获取子任务', async () => {
      const listRes = await request(app).get('/api/tasks')
      const taskId = listRes.body.data.tasks[0].id

      const response = await request(app)
        .get(`/api/tasks/${taskId}/subtasks`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.subtasks).toBeInstanceOf(Array)
    })

    it('应该返回 404 对于不存在的任务', async () => {
      const response = await request(app)
        .get('/api/tasks/non-existent-id/subtasks')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })
})
