// 认证路由
import { Router } from 'express'
import {
  login,
  loginBySms,
  register,
  logout,
  refreshToken,
  getCurrentUser,
  sendSmsCode,
} from '../controllers/auth.js'

const router = Router()

// 短信登录相关
router.post('/sms/send', sendSmsCode)
router.post('/login/sms', loginBySms)

// 传统登录
router.post('/login', login)
router.post('/register', register)
router.post('/logout', logout)
router.post('/refresh', refreshToken)
router.get('/me', getCurrentUser)

export default router
