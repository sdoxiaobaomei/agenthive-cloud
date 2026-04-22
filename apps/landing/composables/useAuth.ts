import { computed, readonly } from 'vue'
import type { User } from '@agenthive/types'

export type { User } from '@agenthive/types'

// 延迟获取 useApi，避免循环依赖
let authApiInstance: ReturnType<typeof useApi>['auth'] | null = null
const getAuthApi = () => {
  if (!authApiInstance) {
    authApiInstance = useApi().auth
  }
  return authApiInstance
}

export function useAuth() {
  // 使用 useState 创建 SSR 友好的响应式状态
  const token = useState<string | null>('auth-token', () => null)
  const user = useState<User | null>('auth-user', () => null)
  const isInitialized = useState<boolean>('auth-initialized', () => false)

  // 使用 useCookie 存储 token（SSR 友好，自动同步）
  const authCookie = useCookie<string | null>('agenthive-token', {
    maxAge: 60 * 60 * 24 * 7, // 7天
    default: () => null,
    path: '/',
    sameSite: 'strict',
  })

  // 初始化：在客户端从 localStorage 读取（SSR 安全）
  if (import.meta.client && !isInitialized.value) {
    try {
      // 优先从 Pinia 持久化存储读取（与 stores/auth.ts 保持一致）
      let savedToken: string | null = null
      let savedUser: User | null = null
      
      const piniaRaw = localStorage.getItem('agenthive:auth')
      if (piniaRaw) {
        try {
          const piniaData = JSON.parse(piniaRaw)
          savedToken = piniaData.token || null
          savedUser = piniaData.user || null
        } catch (e) {
          console.error('Failed to parse Pinia auth data:', e)
        }
      }
      
      // 其次从 cookie 读取，最后从旧版 localStorage 读取（兼容旧版本）
      if (!savedToken) {
        savedToken = authCookie.value || localStorage.getItem('agenthive:auth-token')
      }
      if (!savedUser) {
        const userRaw = localStorage.getItem('agenthive:auth-user')
        if (userRaw) {
          try {
            savedUser = JSON.parse(userRaw)
          } catch (e) {
            console.error('Failed to parse user data:', e)
          }
        }
      }

      if (savedToken) {
        token.value = savedToken
        // 同步到 cookie 以保持最新
        authCookie.value = savedToken
      }

      if (savedUser) {
        user.value = savedUser
      }
    } catch (e) {
      console.error('Failed to access storage:', e)
    }
    isInitialized.value = true
  }

  const isAuthenticated = () => !!token.value

  const userInitial = computed(() => {
    return user.value?.name?.charAt(0) || 'U'
  })

  /**
   * 登录 - 使用真实 API
   * @param phone 手机号
   * @param code 验证码
   */
  const login = async (phone: string, code: string) => {
    // 调用真实 API 进行短信登录
    const response = await getAuthApi().loginBySms({ phone, code })

    if (!response.success || !response.data) {
      throw new Error(response.message || '登录失败')
    }

    const { token: newToken, user: userData } = response.data
    token.value = newToken
    user.value = userData

    // 仅在客户端保存（SSR 安全）
    if (import.meta.client) {
      try {
        // 保存到 cookie（SSR 友好）
        authCookie.value = newToken
        // 同时保存到 localStorage（兼容性）
        localStorage.setItem('agenthive:auth-token', newToken)
        localStorage.setItem('agenthive:auth-user', JSON.stringify(userData))
      } catch (e) {
        console.error('Failed to save auth data:', e)
      }
    }

    return userData
  }

  /**
   * 用户名密码登录 - 使用真实 API
   * @param username 用户名
   * @param password 密码
   */
  const loginByPassword = async (username: string, password: string) => {
    const response = await getAuthApi().login({ username, password })

    if (!response.success || !response.data) {
      throw new Error(response.message || '登录失败')
    }

    const { token: newToken, user: userData } = response.data
    token.value = newToken
    user.value = userData

    // 仅在客户端保存（SSR 安全）
    if (import.meta.client) {
      try {
        authCookie.value = newToken
        localStorage.setItem('agenthive:auth-token', newToken)
        localStorage.setItem('agenthive:auth-user', JSON.stringify(userData))
      } catch (e) {
        console.error('Failed to save auth data:', e)
      }
    }

    return userData
  }

  /**
   * 刷新用户信息 - 使用真实 API
   */
  const refreshUser = async (): Promise<User> => {
    const response = await getAuthApi().me()

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取用户信息失败')
    }

    user.value = response.data

    // 更新 localStorage 中的用户信息
    if (import.meta.client) {
      try {
        localStorage.setItem('agenthive:auth-user', JSON.stringify(response.data))
      } catch (e) {
        console.error('Failed to update user data:', e)
      }
    }

    return response.data
  }

  /**
   * 登出 - 使用真实 API
   */
  const logout = async () => {
    try {
      // 调用后端登出接口
      await getAuthApi().logout()
    } catch (e) {
      console.error('Logout API error:', e)
    } finally {
      // 无论后端是否成功，都清除本地状态
      token.value = null
      user.value = null

      // 仅在客户端清除（SSR 安全）
      if (import.meta.client) {
        try {
          // 清除 cookie
          authCookie.value = null
          // 清除 localStorage
          localStorage.removeItem('agenthive:auth-token')
          localStorage.removeItem('agenthive:auth-user')
        } catch (e) {
          console.error('Failed to clear auth data:', e)
        }
      }
    }
  }

  /**
   * 设置 Token（用于初始化或刷新）
   * @param newToken JWT Token
   */
  const setToken = (newToken: string) => {
    token.value = newToken
    if (import.meta.client) {
      try {
        authCookie.value = newToken
        localStorage.setItem('agenthive:auth-token', newToken)
      } catch (e) {
        console.error('Failed to set token:', e)
      }
    }
  }

  /**
   * 设置用户信息
   * @param userData 用户信息
   */
  const setUser = (userData: User) => {
    user.value = userData
    if (import.meta.client) {
      try {
        localStorage.setItem('agenthive:auth-user', JSON.stringify(userData))
      } catch (e) {
        console.error('Failed to set user:', e)
      }
    }
  }

  return {
    // 使用 readonly 防止外部直接修改
    token: readonly(token),
    user: readonly(user),
    userInitial,
    isAuthenticated,
    login,
    loginByPassword,
    logout,
    refreshUser,
    setToken,
    setUser,
  }
}
