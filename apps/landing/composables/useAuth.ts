import { computed, readonly, toRef } from 'vue'
import type { User } from '@agenthive/types'

export type { User } from '@agenthive/types'

export function useAuth() {
  // 统一使用 Pinia store 作为唯一 token 来源
  const authStore = useAuthStore()

  // 直接引用 Pinia store 的 state，保持响应式同步
  const token = toRef(authStore, 'token')
  const user = toRef(authStore, 'user')

  const isAuthenticated = () => authStore.isAuthenticated

  const userInitial = computed(() => {
    return user.value?.name?.charAt(0) || 'U'
  })

  /**
   * 登录 - 委托给 Pinia store
   * @param phone 手机号
   * @param code 验证码
   */
  const login = async (phone: string, code: string) => {
    return authStore.login(phone, code)
  }

  /**
   * 用户名密码登录 - 委托给 Pinia store
   * @param username 用户名
   * @param password 密码
   */
  const loginByPassword = async (username: string, password: string) => {
    return authStore.loginByPassword(username, password)
  }

  /**
   * 刷新用户信息 - 委托给 Pinia store
   */
  const refreshUser = async (): Promise<User> => {
    return authStore.refreshUser()
  }

  /**
   * 登出 - 委托给 Pinia store
   */
  const logout = async () => {
    return authStore.logout()
  }

  /**
   * 设置 Token（用于初始化或刷新）
   * @param newToken JWT Token
   */
  const setToken = (newToken: string) => {
    authStore.setToken(newToken)
  }

  /**
   * 设置用户信息
   * @param userData 用户信息
   */
  const setUser = (userData: User) => {
    authStore.setUser(userData)
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
