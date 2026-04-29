<script setup lang="ts">
import { ref, reactive, computed, onUnmounted, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Lock, Iphone, View, Hide } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: false,
  // 允许已登录用户访问登录页，不自动重定向
  auth: false,
})

useSeoMeta({
  title: '登录 / 注册 - AgentHive',
  description: '登录 AgentHive 开始与 AI Agent 团队协作',
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const mode = ref('code') // 'code' | 'password'
const loading = ref(false)
const isTyping = ref(false)
const showPassword = ref(false)

const countdown = ref(0)
const timer = ref<number | null>(null)
const agreed = ref(false)
// devCode removed: Java SMS API does not return verification code in response

const form = reactive({
  phone: '',
  code: '',
  password: ''
})

// 新用户补全资料
const showProfileModal = ref(false)
const profileForm = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})
const profileLoading = ref(false)

// 简化的表单验证规则
const rules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为6位数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

const formRef = ref()

const sendCode = async () => {
  if (!form.phone) {
    ElMessage.error('请输入手机号')
    return
  }
  
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    ElMessage.error('请输入正确的手机号')
    return
  }
  
  try {
    loading.value = true
    // 调用 authStore 发送验证码
    const { auth } = useApi()
    const response = await auth.sendSms({ phone: form.phone, type: 'login' })
    if (!response.success) {
      throw new Error(response.message || '发送验证码失败')
    }
    ElMessage.success('验证码已发送')
    
    // 开始倒计时
    countdown.value = 60
    timer.value = window.setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && timer.value) {
        clearInterval(timer.value)
        timer.value = null
      }
    }, 1000)
  } catch (error: any) {
    console.error('[SendCode] Error:', error)
    ElMessage.error(error.message || '发送验证码失败')
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
})

// 已登录用户自动重定向
onMounted(() => {
  if (authStore.isAuthenticated) {
    const redirect = route.query.redirect as string
    const targetPath = redirect || '/'
    router.replace(targetPath)
  }
})

const handleCompleteProfile = async () => {
  // 新用户欢迎流程：直接跳转到工作区
  // TODO: 如需绑定用户名密码，可在此调用 auth.register() 走 Java 注册接口
  showProfileModal.value = false
  const redirect = route.query.redirect as string
  const targetPath = redirect || '/chat'
  await router.push(targetPath)
}

const handleSubmit = async () => {
  if (!agreed.value) {
    ElMessage.warning('请先同意服务协议和隐私政策')
    return
  }
  
  if (!formRef.value) {
    console.error('[Login] formRef is not ready')
    ElMessage.error('表单未准备好，请刷新页面重试')
    return
  }
  
  // 手动验证，避免 Element Plus 验证卡住
  if (mode.value === 'code') {
    // 验证码登录验证
    if (!form.phone) {
      ElMessage.error('请输入手机号')
      return
    }
    if (!/^1[3-9]\d{9}$/.test(form.phone)) {
      ElMessage.error('请输入正确的手机号')
      return
    }
    if (!form.code) {
      ElMessage.error('请输入验证码')
      return
    }
    if (!/^\d{6}$/.test(form.code)) {
      ElMessage.error('验证码为6位数字')
      return
    }
  } else {
    // 密码登录验证
    if (!form.phone) {
      ElMessage.error('请输入用户名/手机号')
      return
    }
    if (form.phone.length < 3) {
      ElMessage.error('用户名/手机号至少需要3个字符')
      return
    }
    if (!form.password) {
      ElMessage.error('请输入密码')
      return
    }
    if (form.password.length < 6) {
      ElMessage.error('密码长度不能少于6位')
      return
    }
  }

  loading.value = true
  
  try {
    let isNewUser = false
    if (mode.value === 'code') {
      const result = await authStore.login(form.phone, form.code)
      isNewUser = result.isNewUser
    } else {
      await authStore.loginByPassword(form.phone, form.password)
    }

    ElMessage.success('登录成功')

    // 新用户引导补全资料
    if (isNewUser) {
      showProfileModal.value = true
      loading.value = false
      return
    }

    // 登录成功 - 跳转到目标页面
    const redirect = route.query.redirect as string
    const targetPath = redirect || '/chat'

    try {
      await router.push(targetPath)
    } catch (navError: any) {
      console.error('[Login] Navigation failed:', navError)
      // 如果导航失败，尝试强制跳转
      window.location.href = targetPath
    }
  } catch (error: any) {
    console.error('[Login] Login error:', error)
    ElMessage.error(error.message || '登录失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen grid grid-cols-1 lg:grid-cols-2">
    <!-- 左侧动画区 -->
    <div class="hidden lg:flex relative flex-col justify-between p-12 overflow-hidden" style="background: linear-gradient(145deg, #f6f6f6 0%, #ebebea 50%, #e1e0e0 100%);">
      <!-- 装饰光晕 -->
      <div class="absolute top-[15%] right-[10%] w-[300px] h-[300px] rounded-full opacity-40 pointer-events-none" style="background: rgba(66, 103, 255, 0.3); filter: blur(80px);" />
      <div class="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full opacity-40 pointer-events-none" style="background: rgba(255, 138, 61, 0.25); filter: blur(100px);" />
      <div class="absolute inset-0 pointer-events-none opacity-30" style="background-image: linear-gradient(rgba(23,23,23,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,0.04) 1px, transparent 1px); background-size: 40px 40px;" />

      <!-- Logo -->
      <div class="relative z-20 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #4267ff;">
          <span class="text-white font-bold text-xl" style="font-family: 'IBM Plex Sans', sans-serif;">A</span>
        </div>
        <span class="text-xl font-bold text-[#171717]" style="font-family: 'IBM Plex Sans', sans-serif;">AgentHive</span>
      </div>

      <!-- 动画角色区域 - 占据主要空间 -->
      <div class="relative z-20 flex-1 flex items-end justify-center min-h-0">
        <AnimatedCharacters
          :is-typing="isTyping"
          :show-password="showPassword"
          :password-length="form.password.length"
          class="h-full max-h-[400px]"
        />
      </div>

      <!-- Feature 信息 - 位于底部，横向排列 -->
      <div class="relative z-20 mt-8 grid grid-cols-2 gap-3">
        <div class="feature-card flex items-center gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40">
          <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-[#4267ff]/10">
            🐕
          </div>
          <div class="min-w-0">
            <h3 class="font-semibold text-[#171717] text-sm truncate">柴犬装修队</h3>
            <p class="text-xs text-[#58585a] truncate">AI Agent 团队协作</p>
          </div>
        </div>
        
        <div class="feature-card flex items-center gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40">
          <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-[#ff8a3d]/10">
            ⚡
          </div>
          <div class="min-w-0">
            <h3 class="font-semibold text-[#171717] text-sm truncate">自动化开发</h3>
            <p class="text-xs text-[#58585a] truncate">MetaGPT SOP 流程</p>
          </div>
        </div>
        
        <div class="feature-card flex items-center gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40">
          <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-[#22c55e]/10">
            🔧
          </div>
          <div class="min-w-0">
            <h3 class="font-semibold text-[#171717] text-sm truncate">实时监控</h3>
            <p class="text-xs text-[#58585a] truncate">可视化 Studio 面板</p>
          </div>
        </div>
        
        <div class="feature-card flex items-center gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40">
          <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-[#a855f7]/10">
            🚀
          </div>
          <div class="min-w-0">
            <h3 class="font-semibold text-[#171717] text-sm truncate">一键部署</h3>
            <p class="text-xs text-[#58585a] truncate">自动构建发布上线</p>
          </div>
        </div>
      </div>

      <!-- 底部链接 -->
      <div class="relative z-20 flex items-center gap-6 text-sm" style="color: #58585a;">
        <NuxtLink to="/" class="hover:text-[#171717] transition-colors">返回首页</NuxtLink>
        <NuxtLink to="/contact" class="hover:text-[#171717] transition-colors">帮助中心</NuxtLink>
        <NuxtLink to="/privacy" class="hover:text-[#171717] transition-colors">隐私政策</NuxtLink>
      </div>
    </div>

    <!-- 右侧表单区 -->
    <div class="flex items-center justify-center p-6 lg:p-12 bg-white">
      <div class="w-full max-w-[400px]">
        <!-- 移动端 Logo -->
        <div class="flex lg:hidden items-center justify-center gap-2 mb-10">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: #4267ff;">
            <span class="text-white font-bold text-lg">A</span>
          </div>
          <span class="text-lg font-bold text-[#171717]">AgentHive</span>
        </div>

        <div class="text-center mb-10">
          <h1 class="text-[26px] font-bold tracking-tight text-[#171717] mb-2" style="font-family: 'IBM Plex Sans', sans-serif;">
            登录 / 注册
          </h1>
          <p class="text-sm" style="color: #58585a;">手机号一键登录，新用户自动注册</p>
        </div>

        <!-- 切换 Tab -->
        <div class="flex items-center gap-1 p-1 rounded-full mb-8" style="background: #f1f1f1;">
          <button
            class="flex-1 py-2 text-sm font-medium rounded-full transition-all"
            :class="mode === 'code' ? 'bg-white text-[#171717] shadow-sm' : 'text-[#58585a] hover:text-[#171717]'"
            @click="mode = 'code'"
          >
            验证码登录
          </button>
          <button
            class="flex-1 py-2 text-sm font-medium rounded-full transition-all"
            :class="mode === 'password' ? 'bg-white text-[#171717] shadow-sm' : 'text-[#58585a] hover:text-[#171717]'"
            @click="mode = 'password'"
          >
            密码登录
          </button>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large">
          <!-- 手机号/用户名 -->
          <div class="text-[13px] font-medium text-[#374151] mb-1.5">
            {{ mode === 'code' ? '手机号' : '用户名/手机号' }}
          </div>
          <el-form-item prop="phone" class="mb-5">
            <el-input
              v-model="form.phone"
              :placeholder="mode === 'code' ? '请输入手机号' : '请输入用户名或手机号'"
              :maxlength="mode === 'code' ? 11 : 50"
              @focus="isTyping = true"
              @blur="isTyping = false"
            >
              <template #prefix>
                <el-icon class="text-[#9ca3af]"><Iphone /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <!-- 验证码 -->
          <template v-if="mode === 'code'">
            <div class="text-[13px] font-medium text-[#374151] mb-1.5">验证码</div>
            <el-form-item prop="code" class="mb-5">
              <el-input
                v-model="form.code"
                placeholder="请输入6位验证码"
                maxlength="6"
                @focus="isTyping = true"
                @blur="isTyping = false"
              >
                <template #prefix>
                  <el-icon class="text-[#9ca3af]"><Lock /></el-icon>
                </template>
                <template #suffix>
                  <button
                    type="button"
                    class="text-sm font-medium transition-colors disabled:opacity-40"
                    :class="countdown > 0 ? 'text-[#9ca3af]' : 'text-[#4267ff] hover:text-[#3151cc]'"
                    :disabled="countdown > 0 || loading"
                    @click="sendCode"
                  >
                    {{ countdown > 0 ? `${countdown}s后重发` : '获取验证码' }}
                  </button>
                </template>
              </el-input>
            </el-form-item>
          </template>

          <!-- 密码 -->
          <template v-else>
            <div class="text-[13px] font-medium text-[#374151] mb-1.5">密码</div>
            <el-form-item prop="password" class="mb-5">
              <el-input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                @focus="isTyping = true"
                @blur="isTyping = false"
              >
                <template #prefix>
                  <el-icon class="text-[#9ca3af]"><Lock /></el-icon>
                </template>
                <template #suffix>
                  <span
                    class="text-[#9ca3af] hover:text-[#374151] cursor-pointer transition-colors"
                    @click="showPassword = !showPassword"
                  >
                    <el-icon v-if="showPassword"><View /></el-icon>
                    <el-icon v-else><Hide /></el-icon>
                  </span>
                </template>
              </el-input>
            </el-form-item>
          </template>

          <!-- 协议 -->
          <div class="flex items-start gap-2 mb-6">
            <input
              id="agree"
              v-model="agreed"
              type="checkbox"
              class="mt-0.5 w-4 h-4 rounded border-[#d1d5db] text-[#4267ff] focus:ring-[#4267ff] cursor-pointer"
            />
            <label for="agree" class="text-xs text-[#6b7280] leading-relaxed cursor-pointer">
              我已阅读并同意
              <NuxtLink to="/privacy" class="text-[#4267ff] hover:underline">《服务协议》</NuxtLink>
              和
              <NuxtLink to="/privacy" class="text-[#4267ff] hover:underline">《隐私政策》</NuxtLink>
            </label>
          </div>

          <el-form-item class="mb-0">
            <el-button
              type="primary"
              size="large"
              class="w-full !h-12 !text-[15px] !font-semibold !rounded-xl"
              style="background: #4267ff; border-color: #4267ff; letter-spacing: 0.5px;"
              :loading="loading"
              @click="handleSubmit"
            >
              {{ loading ? '登录中...' : '登录 / 注册' }}
            </el-button>
          </el-form-item>
        </el-form>

        <!-- 分隔线 -->
        <div class="flex items-center gap-3 my-6">
          <div class="flex-1 h-px bg-[#e5e7eb]" />
          <span class="text-xs text-[#9ca3af]">或</span>
          <div class="flex-1 h-px bg-[#e5e7eb]" />
        </div>

        <button class="w-full h-12 rounded-xl border border-[#e5e7eb] bg-white text-sm font-medium text-[#374151] hover:bg-[#f9fafb] hover:border-[#d1d5db] transition-colors">
          访客模式浏览
        </button>
      </div>
    </div>
  </div>

  <!-- 新用户欢迎弹窗 -->
  <el-dialog
    v-model="showProfileModal"
    title="欢迎加入 AgentHive"
    width="400px"
    :close-on-click-modal="false"
    :show-close="false"
    class="!rounded-2xl"
  >
    <div class="text-sm text-[#58585a] mb-6">
      您已成功注册！现在可以开始创建项目并与 AI Agent 团队协作开发。
    </div>

    <template #footer>
      <el-button
        type="primary"
        class="w-full !h-12 !text-[15px] !font-semibold !rounded-xl"
        style="background: #4267ff; border-color: #4267ff;"
        :loading="profileLoading"
        @click="handleCompleteProfile"
      >
        {{ profileLoading ? '跳转中...' : '进入工作区' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.feature-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.feature-card:hover {
  transform: translateX(8px);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
}

:deep(.el-input__wrapper) {
  background: #fafafa !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 10px !important;
  box-shadow: none !important;
  padding: 0 14px !important;
  transition: border-color 0.2s, box-shadow 0.2s;
}
:deep(.el-input__wrapper:hover) {
  border-color: #4267ff !important;
}
:deep(.el-input__wrapper.is-focus) {
  border-color: #4267ff !important;
  background: #ffffff !important;
  box-shadow: 0 0 0 3px rgba(66, 103, 255, 0.08) !important;
}
:deep(.el-input__inner) {
  background: transparent !important;
  font-size: 14px !important;
  color: #111827 !important;
  height: 48px !important;
}
:deep(.el-input__inner::placeholder) {
  color: #9ca3af !important;
}
:deep(.el-form-item__error) {
  padding-top: 4px !important;
  font-size: 12px !important;
}
</style>
