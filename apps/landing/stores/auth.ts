import { defineStore } from 'pinia'
import 'pinia-plugin-persistedstate'
import type { User } from '@agenthive/types'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const token = ref<string | null>(null)
    const refreshToken = ref<string | null>(null)
    const user = ref<User | null>(null)

    const isAuthenticated = computed(() => !!token.value)
    const currentUser = computed(() => user.value)
    const userInitial = computed(() => user.value?.name?.charAt(0) || 'U')

    function persistTokens() {
      if (typeof window !== 'undefined') {
        if (token.value) {
          localStorage.setItem('agenthive:auth-token', token.value)
        } else {
          localStorage.removeItem('agenthive:auth-token')
        }
        if (refreshToken.value) {
          localStorage.setItem('agenthive:auth-refresh-token', refreshToken.value)
        } else {
          localStorage.removeItem('agenthive:auth-refresh-token')
        }
      }
    }

    async function login(phone: string, code: string): Promise<{ user: User; isNewUser: boolean }> {
      const { auth } = useApi()
      const response = await auth.loginBySms({ phone, code })
      if (!response.success || !response.data) {
        throw new Error(response.message || '登录失败')
      }
      const { accessToken, refreshToken: rt, isNewUser } = response.data
      token.value = accessToken
      refreshToken.value = rt
      persistTokens()
      // 获取用户信息
      const meResponse = await auth.me()
      if (!meResponse.success || !meResponse.data) {
        throw new Error(meResponse.message || '获取用户信息失败')
      }
      user.value = meResponse.data
      return { user: meResponse.data, isNewUser: isNewUser ?? false }
    }

    async function loginByPassword(username: string, password: string): Promise<{ user: User; isNewUser: boolean }> {
      const { auth } = useApi()
      const response = await auth.login({ username, password })
      if (!response.success || !response.data) {
        throw new Error(response.message || '登录失败')
      }
      const { accessToken, refreshToken: rt } = response.data
      token.value = accessToken
      refreshToken.value = rt
      persistTokens()
      const meResponse = await auth.me()
      if (!meResponse.success || !meResponse.data) {
        throw new Error(meResponse.message || '获取用户信息失败')
      }
      user.value = meResponse.data
      return { user: meResponse.data, isNewUser: false }
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

    async function refreshAccessToken(): Promise<string> {
      const { auth } = useApi()
      if (!refreshToken.value) {
        throw new Error('没有刷新令牌')
      }
      const response = await auth.refresh(refreshToken.value)
      if (!response.success || !response.data) {
        throw new Error(response.message || '刷新令牌失败')
      }
      const { accessToken, refreshToken: rt } = response.data
      token.value = accessToken
      refreshToken.value = rt
      persistTokens()
      return accessToken
    }

    async function logout(): Promise<void> {
      const { auth } = useApi()
      try {
        await auth.logout()
      } finally {
        token.value = null
        refreshToken.value = null
        user.value = null
        persistTokens()
      }
    }

    async function refreshUser(): Promise<User> {
      const { auth } = useApi()
      const response = await auth.me()
      if (!response.success || !response.data) {
        throw new Error(response.message || '获取用户信息失败')
      }
      user.value = response.data
      return response.data
    }

    function setToken(t: string): void {
      token.value = t
    }

    function setRefreshToken(rt: string): void {
      refreshToken.value = rt
    }

    function setUser(u: User): void {
      user.value = u
    }

    function clearAuth(): void {
      token.value = null
      refreshToken.value = null
      user.value = null
    }

    return {
      token,
      refreshToken,
      user,
      isAuthenticated,
      currentUser,
      userInitial,
      login,
      loginByPassword,
      sendSmsCode,
      logout,
      refreshUser,
      refreshAccessToken,
      setToken,
      setRefreshToken,
      setUser,
      clearAuth,
    }
  },
  {
    persist: {
      key: 'agenthive:auth',
      storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined,
      pick: ['token', 'refreshToken', 'user'],
      // beforeRestore removed: SSR-safe via localStorage check
    },
  }
)
