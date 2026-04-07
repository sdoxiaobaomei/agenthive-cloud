import { defineStore } from 'pinia'
import type { User } from '@agenthive/types'

interface AuthState {
  token: string | null
  user: User | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    user: null,
  }),

  getters: {
    /** 是否已认证 */
    isAuthenticated: (state): boolean => !!state.token,

    /** 获取用户信息 */
    currentUser: (state): User | null => state.user,

    /** 获取用户名字首字母 */
    userInitial: (state): string => {
      return state.user?.name?.charAt(0) || 'U'
    },
  },

  actions: {
    /**
     * 登录 - 使用 useApi() 调用真实 API
     * @param phone 手机号
     * @param code 验证码
     */
    async login(phone: string, code: string): Promise<User> {
      const { auth } = useApi()

      const response = await auth.loginBySms({ phone, code })

      if (!response.success || !response.data) {
        throw new Error(response.message || '登录失败')
      }

      const { token, user } = response.data
      this.token = token
      this.user = user

      return user
    },

    /**
     * 用户名密码登录 - 使用 useApi() 调用真实 API
     * @param username 用户名
     * @param password 密码
     */
    async loginByPassword(username: string, password: string): Promise<User> {
      const { auth } = useApi()

      const response = await auth.login({ username, password })

      if (!response.success || !response.data) {
        throw new Error(response.message || '登录失败')
      }

      const { token, user } = response.data
      this.token = token
      this.user = user

      return user
    },

    /**
     * 发送短信验证码 - 使用 useApi() 调用真实 API
     * @param phone 手机号
     * @param type 验证码类型
     */
    async sendSmsCode(phone: string, type: 'login' | 'register' | 'reset' = 'login'): Promise<void> {
      const { auth } = useApi()

      const response = await auth.sendSms({ phone, type })

      if (!response.success) {
        throw new Error(response.message || '发送验证码失败')
      }
    },

    /**
     * 登出 - 使用 useApi() 调用真实 API
     */
    async logout(): Promise<void> {
      const { auth } = useApi()

      try {
        // 调用后端登出接口
        await auth.logout()
      } finally {
        // 无论后端是否成功，都清除本地状态
        this.token = null
        this.user = null
      }
    },

    /**
     * 刷新用户信息 - 使用 useApi() 调用 auth.me()
     */
    async refreshUser(): Promise<User> {
      const { auth } = useApi()

      const response = await auth.me()

      if (!response.success || !response.data) {
        throw new Error(response.message || '获取用户信息失败')
      }

      this.user = response.data
      return response.data
    },

    /**
     * 设置 Token（用于初始化或刷新）
     * @param token JWT Token
     */
    setToken(token: string): void {
      this.token = token
    },

    /**
     * 设置用户信息
     * @param user 用户信息
     */
    setUser(user: User): void {
      this.user = user
    },

    /**
     * 清除认证状态
     */
    clearAuth(): void {
      this.token = null
      this.user = null
    },
  },

  persist: {
    key: 'agenthive:auth',
    storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined,
    pick: ['token', 'user'],
    // 在客户端才启用持久化
    beforeRestore: (context) => {
      if (!import.meta.client) {
        return false // 跳过服务端恢复
      }
      return true
    },
  },
})
