import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import { resetData } from '../utils/test-db.js'

describe('Code Controller', () => {
  beforeEach(async () => {
    await resetData()
  })

  describe('GET /api/code/files', () => {
    it('应该获取文件列表', async () => {
      const response = await request(app)
        .get('/api/code/files')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.files).toBeInstanceOf(Array)
      expect(response.body.data.total).toBeDefined()
      expect(response.body.data.path).toBeDefined()
    })

    it('应该支持 path 参数', async () => {
      const response = await request(app)
        .get('/api/code/files?path=/src')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.path).toBe('/src')
    })
  })

  describe('GET /api/code/files/*', () => {
    it('应该获取文件内容', async () => {
      const response = await request(app)
        .get('/api/code/files/README.md')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.path).toBe('/README.md')
      expect(response.body.data.content).toBeDefined()
      expect(response.body.data.language).toBe('markdown')
      expect(response.body.data.lastModified).toBeDefined()
    })

    it('应该获取 Go 文件内容', async () => {
      const response = await request(app)
        .get('/api/code/files/main.go')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.language).toBe('go')
    })

    it('应该返回 404 对于不存在的文件', async () => {
      const response = await request(app)
        .get('/api/code/files/non-existent.txt')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('PUT /api/code/files/*', () => {
    it('应该更新现有文件', async () => {
      const response = await request(app)
        .put('/api/code/files/README.md')
        .send({ content: '# Updated README' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.content).toBe('# Updated README')
      expect(response.body.data.lastModified).toBeDefined()
    })

    it('应该创建新文件', async () => {
      const response = await request(app)
        .put('/api/code/files/new-file.ts')
        .send({ content: 'console.log("hello")' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.path).toBe('/new-file.ts')
      expect(response.body.data.language).toBe('typescript')
    })

    it('应该验证 content 必填', async () => {
      const response = await request(app)
        .put('/api/code/files/test.txt')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('应该正确识别不同语言的文件', async () => {
      const testCases = [
        { path: 'test.py', expected: 'python' },
        { path: 'test.js', expected: 'javascript' },
        { path: 'test.ts', expected: 'typescript' },
        { path: 'test.vue', expected: 'vue' },
        { path: 'test.json', expected: 'json' },
        { path: 'test.css', expected: 'css' },
        { path: 'index.html', expected: 'html' },
        { path: 'test.sql', expected: 'sql' },
      ]

      for (const tc of testCases) {
        const response = await request(app)
          .put(`/api/code/files/${tc.path}`)
          .send({ content: 'test' })

        expect(response.status).toBe(200)
        expect(response.body.data.language).toBe(tc.expected)
      }
    })
  })

  describe('DELETE /api/code/files/*', () => {
    it('应该删除文件', async () => {
      // 先创建一个文件
      await request(app)
        .put('/api/code/files/to-delete.txt')
        .send({ content: 'delete me' })

      const response = await request(app)
        .delete('/api/code/files/to-delete.txt')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 确认已删除
      const getRes = await request(app).get('/api/code/files/to-delete.txt')
      expect(getRes.status).toBe(404)
    })

    it('应该返回 404 对于不存在的文件', async () => {
      const response = await request(app)
        .delete('/api/code/files/non-existent.txt')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/code/search', () => {
    it('应该搜索文件', async () => {
      const response = await request(app)
        .get('/api/code/search?query=auth')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.files).toBeInstanceOf(Array)
      expect(response.body.data.total).toBeDefined()
      expect(response.body.data.query).toBe('auth')
    })

    it('应该支持内容搜索', async () => {
      const response = await request(app)
        .get('/api/code/search?query=AgentHive')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    it('应该验证 query 必填', async () => {
      const response = await request(app)
        .get('/api/code/search')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('空搜索结果应该返回空数组', async () => {
      const response = await request(app)
        .get('/api/code/search?query=xyznotfound123')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.files).toHaveLength(0)
      expect(response.body.data.total).toBe(0)
    })
  })

  describe('GET /api/code/recent', () => {
    it('应该获取最近文件', async () => {
      const response = await request(app)
        .get('/api/code/recent')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.files).toBeInstanceOf(Array)
      expect(response.body.data.total).toBeDefined()
    })

    it('应该支持 limit 参数', async () => {
      const response = await request(app)
        .get('/api/code/recent?limit=2')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.files.length).toBeLessThanOrEqual(2)
    })

    it('应该按时间倒序排列', async () => {
      // 更新一个文件
      await request(app)
        .put('/api/code/files/README.md')
        .send({ content: '# Updated' })

      const response = await request(app)
        .get('/api/code/recent?limit=1')

      expect(response.status).toBe(200)
      expect(response.body.data.files[0].path).toBe('/README.md')
    })
  })
})
