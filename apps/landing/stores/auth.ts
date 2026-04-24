import { defineStore } from 'pinia'
import 'pinia-plugin-persistedstate'
import type { User } from '@agenthive/types'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const token = ref<string | null>(null)
    const user = ref<User | null>(null)

    const isAuthenticated = computed(() => !!token.value)
    const currentUser = computed(() => user.value)
    const userInitial = computed(() => user.value?.name?.charAt(0) || 'U')

    function mapUserVO(vo: any): User {
      return {
        id: String(vo.id ?? ''),
        username: vo.username ?? '',
        name: vo.name ?? vo.username ?? '',
        email: vo.email,
        phone: vo.phone,
        role: vo.roles?.[0] ?? vo.role ?? 'user',
        avatar: vo.avatar,
        createdAt: vo.createdAt ? String(vo.createdAt) : '',
        updatedAt: vo.updatedAt ? String(vo.updatedAt) : '',
      }
    }

    async function login(phone: string, code: string): Promise<User> {
      const { auth } = useApi()
      const response = await auth.loginBySms({ phone, code })
      if (!response.success || !response.data) {
        throw new Error(response.message || '登录失败')
      }
      // Java 返回 { accessToken, refreshToken, expiresIn, tokenType }
      const accessToken = response.data.accessToken || response.data.token
      if (!accessToken) {
        throw new Error('登录失败：未返回 Token')
      }
      token.value = accessToken
      if (typeof window !== 'undefined') {
        localStorage.setItem('agenthive:auth-token', accessToken)
      }
      // 登录成功后获取用户信息
      const userResponse = await auth.me()
      if (!userResponse.success || !userResponse.data) {
        throw new Error(userResponse.message || '获取用户信息失败')
      }
      const userData = mapUserVO(userResponse.data)
      user.value = userData
      return userData
    }

    async function loginByPassword(username: string, password: string): Promise<User> {
      const { auth } = useApi()
      const response = await auth.login({ username, password })
      if (!response.success || !response.data) {
        throw new Error(response.message || '登录失败')
      }
      const accessToken = response.data.accessToken || response.data.token
      if (!accessToken) {
        throw new Error('登录失败：未返回 Token')
      }
      token.value = accessToken
      if (typeof window !== 'undefined') {
        localStorage.setItem('agenthive:auth-token', accessToken)
      }
      const userResponse = await auth.me()
      if (!userResponse.success || !userResponse.data) {
        throw new Error(userResponse.message || '获取用户信息失败')
      }
      const userData = mapUserVO(userResponse.data)
      user.value = userData
      return userData
    }

    async function sendSmsCode(
      phone: string,
      type: 'login' | 'register' | 'reset' = 'login'
    ): Promise<void> {
      const { auth } = useApi()
      const response = await auth.sendSms({ phone, type })
      if (!response.success) {
        throw new Error(response.message || '发送验证码失败')
      }
    }

    async function logout(): Promise<void> {
      const { auth } = useApi()
      try {
        await auth.logout()
      } finally {
        token.value = null
        user.value = null
        if (typeof window !== 'undefined') {
          localStorage.removeItem('agenthive:auth-token')
        }
      }
    }

    async function refreshUser(): Promise<User> {
      const { auth } = useApi()
      const response = await auth.me()
      if (!response.success || !response.data) {
        throw new Error(response.message || '获取用户信息失败')
      }
      const userData = mapUserVO(response.data)
      user.value = userData
      return userData
    }

    function setToken(t: string): void {
      token.value = t
    }

    function setUser(u: User): void {
      user.value = u
    }

    function clearAuth(): void {
      token.value = null
      user.value = null
    }

    return {
      token,
      user,
      isAuthenticated,
      currentUser,
      userInitial,
      login,
      loginByPassword,
      sendSmsCode,
      logout,
      refreshUser,
      setToken,
      setUser,
      clearAuth,
    }
  },
  {
    persist: {
      key: 'agenthive:auth',
      storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined,
      pick: ['token', 'user'],
      // beforeRestore removed: SSR-safe via localStorage check
    },
  }
)
