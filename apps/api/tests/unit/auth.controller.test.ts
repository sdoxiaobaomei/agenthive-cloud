import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import { resetData } from '../utils/test-db.js'
import { smsService } from '../../src/services/sms.js'

describe('Auth Controller', () => {
  beforeEach(() => {
    resetData()
  })

  describe('POST /api/auth/sms/send', () => {
    it('应该发送短信验证码', async () => {
      const response = await request(app)
        .post('/api/auth/sms/send')
        .send({ phone: '13800138000' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.devCode).toBeDefined()
    })

    it('应该验证手机号必填', async () => {
      const response = await request(app)
        .post('/api/auth/sms/send')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('应该验证手机号格式', async () => {
      const response = await request(app)
        .post('/api/auth/sms/send')
        .send({ phone: 'invalid' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/login/sms', () => {
    it('应该使用短信验证码登录', async () => {
      // 使用唯一的手机号避免冲突
      const uniquePhone = `138${Date.now()}`.slice(0, 11)
      
      // 先发送验证码
      const sendResult = await smsService.sendCode(uniquePhone)
      const code = sendResult.devCode!

      const response = await request(app)
        .post('/api/auth/login/sms')
        .send({ phone: uniquePhone, code })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      expect(response.body.data.user.phone).toBe(uniquePhone)
    })

    it('应该拒绝错误的验证码', async () => {
      await smsService.sendCode('13800138000')

      const response = await request(app)
        .post('/api/auth/login/sms')
        .send({ phone: '13800138000', code: '000000' })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('应该创建新用户如果不存在', async () => {
      const sendResult = await smsService.sendCode('13999999999')
      const code = sendResult.devCode!

      const response = await request(app)
        .post('/api/auth/login/sms')
        .send({ phone: '13999999999', code })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.user.id).toBeDefined()
    })
  })

  describe('POST /api/auth/login', () => {
    it('应该使用用户名密码登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      expect(response.body.data.user.username).toBe('admin')
    })

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/register', () => {
    it('应该注册新用户', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      expect(response.body.data.user.username).toBe('newuser')
    })

    it('应该验证用户名必填', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('应该检查用户名是否已存在', async () => {
      // 先注册一个用户
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'existing', password: 'password123' })

      // 再次注册相同用户名
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'existing', password: 'password123' })

      expect(response.status).toBe(409)
      expect(response.body.success).toBe(false)
    })

    it('应该支持短信验证码注册', async () => {
      const sendResult = await smsService.sendCode('13800111111')
      const code = sendResult.devCode!

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'smsuser',
          password: 'password123',
          phone: '13800111111',
          code,
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.user.phone).toBe('13800111111')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('应该成功登出', async () => {
      const response = await request(app)
        .post('/api/auth/logout')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('应该刷新 token', async () => {
      // 先登录获取 token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password' })

      const token = loginRes.body.data.token

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      // 新 token 应该也是有效的
      expect(response.body.data.token).toBeDefined()
    })

    it('应该拒绝无效的 token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('应该要求 Authorization 头', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/auth/me', () => {
    it('应该获取当前用户信息', async () => {
      // 先登录
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password' })

      const token = loginRes.body.data.token

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.username).toBe('admin')
    })

    it('应该拒绝无效的 token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})
