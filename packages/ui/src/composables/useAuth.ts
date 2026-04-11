import { ref, computed, onMounted } from 'vue'

export interface User {
  id: string
  name: string
  phone: string
  avatar?: string
}

const token = ref<string | null>(null)
const user = ref<User | null>(null)
const isInitialized = ref(false)

// Mock 用户数据
const MOCK_USER: User = {
  id: 'user-001',
  name: '测试用户',
  phone: '13800138000',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
}

export function useAuth() {
  // 在客户端初始化时从 localStorage 读取
  onMounted(() => {
    if (isInitialized.value) return
    
    if (typeof window !== 'undefined') {
      try {
        const savedToken = localStorage.getItem('agenthive:auth-token')
        const savedUser = localStorage.getItem('agenthive:auth-user')
        if (savedToken) {
          token.value = savedToken
        }
        if (savedUser) {
          try {
            user.value = JSON.parse(savedUser)
          } catch (e) {
            console.error('Failed to parse user data:', e)
          }
        }
      } catch (e) {
        console.error('Failed to access localStorage:', e)
      }
    }
    isInitialized.value = true
  })

  const isAuthenticated = () => !!token.value

  const currentUser = computed(() => user.value)

  const userInitial = computed(() => {
    return user.value?.name?.charAt(0) || 'U'
  })

  // Mock 登录 - 自动创建一个虚拟用户
  const login = async (_phone: string, _code?: string) => {
    // 模拟 API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 生成 mock token
    const mockToken = `mock-token-${Date.now()}`
    token.value = mockToken
    user.value = { ...MOCK_USER, phone: _phone || MOCK_USER.phone }
    
    // 仅在客户端保存到 localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('agenthive:auth-token', mockToken)
        localStorage.setItem('agenthive:auth-user', JSON.stringify(user.value))
      } catch (e) {
        console.error('Failed to save to localStorage:', e)
      }
    }
    
    return user.value
  }

  const logout = () => {
    token.value = null
    user.value = null
    
    // 仅在客户端清除 localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('agenthive:auth-token')
        localStorage.removeItem('agenthive:auth-user')
      } catch (e) {
        console.error('Failed to clear localStorage:', e)
      }
    }
  }

  return {
    token,
    user: currentUser,
    userInitial,
    isAuthenticated,
    login,
    logout,
  }
}
